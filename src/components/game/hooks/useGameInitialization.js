import { useCallback } from 'react';
import WebHelper from '../../../helpers/WebHelper';
import LayoutHelper from '../../../helpers/LayoutCloneHelper';
import ClientMediator from '../../../ClientMediator';
import PropertiesHelperInstance from '../../../helpers/PropertiesHelper';
import WebSocketManagerInstance from '../WebSocketManager';
import DockableHelper from '../../../helpers/DockableHelper';
import CardAPI from '../../../CardAPI';
import ScriptAPI from '../../../ScriptAPI';

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
  const {
    setCurrentPlayerId,
    setPlayers,
    setLayout,
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

      localStorage.setItem('gmMode', game.master.id === player.id ? 'true' : 'false');
      setPlayers(game.players);

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
      ClientMediator.register(PropertiesHelperInstance);
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
    } finally {
      gameInitializationInProgress = false;
    }
  }, [state, CreateLayoutElement, setCurrentPlayerId, setPlayers, setLayout, currentPlayerRef, gameRef]);

  return {
    loadGame,
    resetInitialization: () => {
      gameInitializationInProgress = false;
      gameInitialized = false;
      console.log('Game initialization state reset');
    },
    isInitialized: () => gameInitialized,
  };
};
