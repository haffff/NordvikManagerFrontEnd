import { useCallback, useState } from 'react';
import LayoutHelper from '../../../helpers/LayoutCloneHelper';
import ClientMediator from '../../../ClientMediator';
import { PropertiesManagerInstance } from '../../../CardAPI';
import { ActiveWebHelper as WebHelper, ActiveTransportManager as WebSocketManagerInstance } from '../../../helpers/transport';
import DockableHelper from '../../../helpers/DockableHelper';
import CardAPI from '../../../CardAPI';
import ScriptAPI from '../../../ScriptAPI';
import { _entityPermissionSetter } from '../../../contexts/PermissionsContext';
import { ENTITY_TYPES, PERM } from '../../BattleMap/helpers/permissionBits';

// Global flags to prevent duplicate game initialization
let gameInitializationInProgress = false;
let gameInitialized = false;

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
  } = gameState;

  const loadGame = useCallback(async () => {
    if (gameInitializationInProgress || gameInitialized) {
      console.log('Game initialization already in progress or completed');
      return;
    }

    gameInitializationInProgress = true;

    try {
      console.log('Starting game initialization...');

      // ── Fetch core data ────────────────────────────────────────────────────
      const player = await WebHelper.getAsync('battlemap/getplayer');
      currentPlayerRef.current = player;
      setCurrentPlayerId(player.id);

      const game = await WebHelper.getAsync('battlemap/getfullgame');
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

      // ── Load default layout ────────────────────────────────────────────────
      const gameLayout = game.defaultLayout?.value;
      console.log('useGameInitialization: received defaultLayout', { defaultLayout: game.defaultLayout });
      setLayout(game.defaultLayout);

      if (gameLayout) {
        try {
          LayoutHelper.LoadLayoutState(state, gameLayout, CreateLayoutElement);
        } catch (e) {
          console.error('useGameInitialization: failed to apply layout', e, { gameLayout });
        }
      } else {
        console.warn('useGameInitialization: no default layout value to load');
      }

      // ── Bootstrap ─────────────────────────────────────────────────────────
      ClientMediator.fireEvent('BattleMapsChanged', game.battleMaps);
      ClientMediator.register(PropertiesManagerInstance);
      WebSocketManagerInstance.Send({ command: 'player_list' });

      window.CreateCardAPI = CardAPI;
      window.ScriptAPI = ScriptAPI;
      DockableHelper.State = state;
      WebSocketManagerInstance.Send({ command: 'client_loaded' });

      gameInitialized = true;
      console.log('Game initialization completed successfully');

    } catch (error) {
      console.error('Game initialization failed:', error);
      gameInitializationInProgress = false;
      gameInitialized = false;
      setInitError(error?.message || 'Game initialization failed');
    } finally {
      gameInitializationInProgress = false;
    }
  }, [state, CreateLayoutElement, setCurrentPlayerId, setPlayers, setLayout, setIsGM, currentPlayerRef, gameRef]);

  return {
    loadGame,
    initError,
    clearInitError: () => setInitError(null),
    resetInitialization: () => {
      gameInitializationInProgress = false;
      gameInitialized = false;
      setInitError(null);
      console.log('Game initialization state reset');
    },
    isInitialized: () => gameInitialized,
  };
};
