import { useCallback, useState } from 'react';
import LayoutHelper from '../../../helpers/LayoutCloneHelper';
import LayoutPersistence from '../../../helpers/LayoutPersistence';
import { toaster } from '../../ui/toaster';
import ClientMediator from '../../../ClientMediator';
import { PropertiesManagerInstance } from '../../../CardAPI';
import ActionService from '../ActionService';
import { ActiveWebHelper as WebHelper, ActiveTransportManager as WebSocketManagerInstance } from '../../../helpers/transport';
import DockableHelper from '../../../helpers/DockableHelper';
import CardAPI from '../../../CardAPI';
import ScriptAPI from '../../../ScriptAPI';
import { _entityPermissionSetter } from '../../../contexts/PermissionsContext';
import { ENTITY_TYPES, PERM } from '../../BattleMap/Helpers/permissionBits';

// Global flags to prevent duplicate game initialization
let gameInitializationInProgress = false;
let gameInitialized = false;
// Bumped by resetInitialization() (on unmount, and on manual Retry). A loadGame()
// call captures the generation it started with and checks it before committing
// any state — otherwise a loadGame() abandoned by a fast exit/rejoin can resolve
// late and either write into a dead mount's refs, or worse, clear the *new*
// mount's in-progress flag out from under it via a stale `finally`.
let gameInitGeneration = 0;

/**
 * Handles one-time game initialization: fetching player/game data, loading
 * the default layout, and wiring up global APIs.
 *
 * GetGame / GetOwner / GetCurrentPlayer / GetCurrentPlayerColor all live in
 * useGameApi and read from gameRef / currentPlayerRef, which are populated
 * here once the fetch completes — no timing issue, no patchClient needed.
 */
export const useGameInitialization = ({ state, gameState, CreateLayoutElement }) => {
  const [initError, setInitError] = useState(null);
  const {
    setCurrentPlayerId,
    setPlayers,
    setLayout,
    setIsGM,
    currentPlayerRef,
    gameRef,
    keyboardEventsManagerRef,
  } = gameState;

  const loadGame = useCallback(async () => {
    if (gameInitializationInProgress || gameInitialized) {
      console.log('Game initialization already in progress or completed');
      return;
    }

    const myGeneration = gameInitGeneration;
    gameInitializationInProgress = true;

    try {
      console.log('Starting game initialization...');

      // ── Fetch core data ────────────────────────────────────────────────────
      const player = await WebHelper.getAsync('battlemap/getplayer');
      if (myGeneration !== gameInitGeneration) {
        console.log('useGameInitialization: abandoned after getplayer (component unmounted or reset)');
        return;
      }
      if (!player) {
        throw new Error('Failed to load player: server rejected battlemap/getplayer (see console for HTTP status)');
      }
      currentPlayerRef.current = player;
      setCurrentPlayerId(player.id);

      // Exposes ClientMediator.sendCommandAsync("Keyboard", "Fire", { actionName })
      // so shortcuts can be triggered programmatically, not just by real keypresses.
      ClientMediator.register(keyboardEventsManagerRef.current);

      // User-scoped, independent of game data — fire-and-forget so a slow/failed
      // fetch doesn't block the rest of init; shortcuts just fall back to defaults.
      keyboardEventsManagerRef.current
        .GetKeyboardConfigFromCentralServer()
        .catch((e) => console.warn('useGameInitialization: failed to load keyboard bindings', e));

      const game = await WebHelper.getAsync('battlemap/getfullgame');
      if (myGeneration !== gameInitGeneration) {
        console.log('useGameInitialization: abandoned after getfullgame (component unmounted or reset)');
        return;
      }
      // Populate refs so useGameApi's GetGame/GetOwner/GetCurrentPlayer resolve
      gameRef.current = game;

      const gmStatus = game.master.id === player.id;
      localStorage.setItem('gmMode', gmStatus ? 'true' : 'false');
      setIsGM(gmStatus);
      setPlayers(game.players);

      // Load game-level entity permissions for non-GM players
      if (!gmStatus && process.env.REACT_APP_MODE === 'player') {
        try {
          const gamePerms = await WebHelper.getAsync(
            `security/permissions?entityId=${game.id}&entityType=${ENTITY_TYPES.GAME}`
          );
          const bits = gamePerms?.[player.id] ?? PERM.NONE;
          _entityPermissionSetter.current?.(ENTITY_TYPES.GAME, game.id, bits);
        } catch (e) {
          console.warn('useGameInitialization: failed to load game entity permissions', e);
        }
      }

      // ── Load layout: this player's remembered arrangement (if the GM enabled
      //    "saveLayoutOnExit" and one is stored) else the game's default. ──────
      const persisted = game.saveLayoutOnExit ? LayoutPersistence.load(game.id, player.id) : null;
      const layoutToApply = persisted ?? game.defaultLayout?.value;
      setLayout(persisted ? { id: null, name: '(your saved layout)', value: persisted } : game.defaultLayout);

      const countContents = (panel) => {
        if (!panel) return 0;
        let n = (panel.contentList || []).length;
        for (const sp of (panel.splitPanels || [])) n += countContents(sp);
        return n;
      };

      if (layoutToApply) {
        try {
          LayoutHelper.LoadLayoutState(state, layoutToApply, CreateLayoutElement);
          // LoadLayoutState swallows its own errors, so a parseable-but-broken blob
          // yields an empty workspace silently. If a persisted layout produced nothing
          // usable, drop it and fall back to the game default.
          if (persisted && countContents(state?.ref?.current?.rootPanel) === 0) {
            throw new Error('persisted layout restored no panels');
          }
        } catch (e) {
          console.error('useGameInitialization: failed to apply layout', e, { hadPersisted: !!persisted });
          if (persisted) {
            LayoutPersistence.clear(game.id, player.id);
            setLayout(game.defaultLayout);
            try {
              LayoutHelper.LoadLayoutState(state, game.defaultLayout?.value, CreateLayoutElement);
            } catch (_) { /* default is best-effort */ }
            toaster.create({
              description: "Your saved layout couldn't be restored — reset to the game default.",
              type: 'warning',
              duration: 6000,
            });
          }
        }
      } else {
        console.warn('useGameInitialization: no layout value to load');
      }

      WebSocketManagerInstance.Send({ command: 'client_layout_ready' });

      // ── Bootstrap ─────────────────────────────────────────────────────────
      ClientMediator.fireEvent('BattleMapsChanged', game.battleMaps);
      ClientMediator.register(PropertiesManagerInstance);
      ClientMediator.register(ActionService);
      WebSocketManagerInstance.Send({ command: 'player_list' });

      window.CreateCardAPI = CardAPI;
      window.ScriptAPI = ScriptAPI;
      DockableHelper.State = state;
      WebSocketManagerInstance.Send({ command: 'client_loaded' });

      if (myGeneration === gameInitGeneration) {
        gameInitialized = true;
        console.log('Game initialization completed successfully');
      } else {
        console.log('useGameInitialization: completed after being superseded — discarding result');
      }

    } catch (error) {
      console.error('Game initialization failed:', error);
      if (myGeneration === gameInitGeneration) {
        gameInitializationInProgress = false;
        gameInitialized = false;
        setInitError(error?.message || 'Game initialization failed');
      }
    } finally {
      // Only clear the in-progress flag if we're still the current generation —
      // otherwise a late-resolving abandoned call could clear it out from under
      // a newer loadGame() that's already legitimately in progress.
      if (myGeneration === gameInitGeneration) {
        gameInitializationInProgress = false;
      }
    }
  }, [state, CreateLayoutElement, setCurrentPlayerId, setPlayers, setLayout, setIsGM, currentPlayerRef, gameRef, keyboardEventsManagerRef]);

  return {
    loadGame,
    initError,
    clearInitError: () => setInitError(null),
    resetInitialization: () => {
      gameInitGeneration++;
      gameInitializationInProgress = false;
      gameInitialized = false;
      setInitError(null);
      console.log('Game initialization state reset');
    },
    isInitialized: () => gameInitialized,
  };
};
