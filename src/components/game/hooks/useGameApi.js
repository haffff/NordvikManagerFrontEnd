import React from 'react';
import ClientMediator from '../../../ClientMediator';
import DockableHelper from '../../../helpers/DockableHelper';
import { ActiveWebHelper as WebHelper } from '../../../helpers/transport';
import LayoutHelper from '../../../helpers/LayoutCloneHelper';
import UtilityHelper from '../../../helpers/UtilityHelper';
import { ROLES } from '../../../contexts/PermissionsContext';
import { _entityPermissionSetter } from '../../../contexts/PermissionsContext';
import BrowserWindowPortal from '../../uiComponents/base/BrowserWindowPortal';

// (recentContextOps removed — replaced with pendingBMContextIds ref inside useGameApi)

/**
 * Registers the "Game" interface with ClientMediator.
 *
 * This is the SINGLE public API surface that every panel, helper and external
 * script uses to interact with the game.  It lives in a useEffect so React
 * re-registers it (with fresh closures) whenever gameState, state, or
 * CreateLayoutElement changes — fixing the stale-closure problem that existed
 * when registration happened once inside loadGame.
 *
 * Consumers call e.g.:
 *   ClientMediator.sendCommand("Game", "GetPlayers")
 *   ClientMediator.sendCommand("Game", "SetLayout", { id })
 *   ClientMediator.sendCommand("Game", "CreateNewPanel", { type, props })
 */
export const useGameApi = ({ state, gameState, CreateLayoutElement, playerRef: _playerRef }) => {
  const {
    gameID,
    playersRef,
    connectedPlayersRef,
    battleMapsContextsRef,
    battleMapContexts,
    setBattleMapContexts,
    setLayout,
    selectedBattleMapId,
    setSelectedBattleMapId,
    portaledPanels,
    setPortaledPanels,
    onExit,
    gameContainerRef,
    quickCommandDialogOpenRef,
    layout,
    UpdateAfterTime,
    currentPlayerRef,
    gameRef,
    isGM,
  } = gameState;

  // Synchronous dedup for AddBattleMapContext.
  // battleMapsContextsRef is only updated on the next render (React async state),
  // so we need an immediately-consistent ref to prevent rapid double-registration
  // while also allowing legitimate re-registration after unmount/remount.
  const pendingBMContextIds = React.useRef(new Set());

  React.useEffect(() => {    // SetLayout is also exported so useGameEventHandlers can call it directly.
    // Accepts both a plain id string and a { id } object so all callers work.
    const SetLayout = async (idOrObj) => {
      const id = idOrObj?.id ?? idOrObj;
      const fetched = await WebHelper.getAsync(`battlemap/GetLayout?id=${id}`);
      state.ref.current.rootPanel = undefined;
      LayoutHelper.LoadLayoutState(state, fetched.value, CreateLayoutElement);
      setLayout(fetched);
    };    
    
    const gameApi = {
      id: 'Game',
      panel: 'Game',

      // ── $meta: command documentation ─────────────────────────────────────────
      // Consumed by CommandExecutionHelper.LoadSuggestions to build rich
      // suggestions (description + typed arg list) for the QuickCommandDialog.
      $meta: {        SetLayout: {
          description: 'Load and apply a saved panel layout by its ID.',
          args: [{ name: 'id', type: 'layoutid', required: true }],
        },
        GetGame: {
          description: 'Returns the current game object (owner, maps, settings).',
          args: [],
        },
        GetOwner: {
          description: 'Returns the user-ID of the game master / owner.',
          args: [],
        },
        GetRole: {
          description: 'Returns the current user\'s role: "admin", "gm", or "player".',
          args: [],
        },
        GetIsGM: {
          description: 'Returns true if the current user is the game master or admin.',
          args: [],
        },
        GetGameId: {
          description: 'Returns the current game ID string.',
          args: [],
        },
        GetContainerRef: {
          description: 'Returns a React ref to the root game container DOM node.',
          args: [],
        },
        GetCurrentPlayer: {
          description: 'Returns the local player object for the logged-in user.',
          args: [],
        },
        GetCurrentPlayerColor: {
          description: 'Returns the CSS color string of the local player.',
          args: [],
        },
        GetPlayers: {
          description: 'Returns the full array of players in this game.',
          args: [],
        },
        GetConnectedPlayers: {
          description: 'Returns the array of currently connected / online players.',
          args: [],
        },        GetPlayer: {
          description: 'Returns a single player by id.',
          args: [{ name: 'id', type: 'playerid', required: true }],
        },
        AddBattleMapContext: {
          description: 'Registers an open BattleMap context so other panels can find it.',
          args: [{ name: 'battleMapContext', type: 'object', required: true }],
        },        DeleteBattleMapContext: {
          description: 'Removes a BattleMap context by its ID.',
          args: [{ name: 'id', type: 'bmcontext', required: true }],
        },GetBattleMapContext: {
          description: 'Returns the BattleMap context registered under the given ID.',
          args: [{ name: 'id', type: 'bmcontext', required: true }],
        },
        GetOpenedBattleMaps: {
          description: 'Returns an array of all currently open BattleMap contexts.',
          args: [],
        },
        GetActiveBattleMapId: {
          description: 'Returns (async) the ID of the currently active / focused BattleMap.',
          args: [],
        },
        GetMaps: {
          description: 'Fetches the flat list of all maps from the server.',
          args: [],
        },
        GetLayout: {
          description: 'Returns the currently loaded layout object.',
          args: [],
        },
        CreateLayoutElement: {
          description: 'Creates a React layout element for a given panel type.',
          args: [
            { name: 'type', type: 'string', required: true },
            { name: 'syncId', type: 'string', required: false },
            { name: 'props', type: 'object', required: false },
          ],
        },        CreateNewPanel: {
          description: 'Creates and floats (or windows) a new panel of the given type.',
          args: [
            { name: 'type', type: 'string', required: true },
            { name: 'props', type: 'object', required: false },
            { name: 'battleMapId', type: 'bmcontext', required: false },
            { name: 'inWindow', type: 'boolean', required: false },
            { name: 'isCommand', type: 'boolean', required: false },
          ],
        },
        OpenRun: {
          description: 'Opens the Quick-Command dialog (Ctrl+P / Cmd+P).',
          args: [],
        },
        Exit: {
          description: 'Exits the current game session and returns to the lobby.',
          args: [],
        },
      },


      // ── Layout ──────────────────────────────────────────────────────────────
      SetLayout,
      update: UpdateAfterTime,
      CreateLayoutElement,
      GetLayout: () => layout,

            // ── BattleMap contexts ─────────────────────────────────────────────────
      AddBattleMapContext: (objOrWrapped) => {
        // Accept both raw battleMapContext object and { battleMapContext } wrapper
        const battleMapContext = objOrWrapped?.battleMapContext ?? objOrWrapped;
        const id = battleMapContext?.id;
        if (!id) return;
        // Check both the state-synced ref AND the synchronous pending set.
        // battleMapsContextsRef is only updated on the next render, so pending
        // tracks IDs submitted this render cycle before the ref catches up.
        const current = battleMapsContextsRef.current || {};
        if (current[id] || pendingBMContextIds.current.has(id)) {
          console.warn(`AddBattleMapContext: "${id}" already registered — ignoring duplicate`);
          return;
        }
        pendingBMContextIds.current.add(id);
        const next = { ...current, [id]: battleMapContext };
        setBattleMapContexts(next);
        ClientMediator.fireEvent('BattleMapsChanged', next);
      },

      GetBattleMapContext: (idOrObj) => {
        const id = idOrObj?.id ?? idOrObj;
        return battleMapsContextsRef.current[id];
      },

      DeleteBattleMapContext: (idOrObj) => {
        const id = idOrObj?.id ?? idOrObj;
        if (!id) return;
        const current = battleMapsContextsRef.current || {};
        if (!current[id]) return;
        // Clear from pending so a remount can re-register immediately.
        pendingBMContextIds.current.delete(id);
        const next = { ...current };
        delete next[id];
        setBattleMapContexts(next);
        ClientMediator.fireEvent('BattleMapsChanged', next);
      },

      GetOpenedBattleMaps: () => Object.values(battleMapsContextsRef.current),

      GetActiveBattleMapId: async () => {
        if (selectedBattleMapId !== undefined) return selectedBattleMapId;

        while (!Object.values(battleMapsContextsRef.current)[0]) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        const first = Object.values(battleMapsContextsRef.current)[0]?.id;
        setSelectedBattleMapId(first);
        return first;
      },

      // ── Players ──────────────────────────────────────────────────────────────
      GetPlayers: () => playersRef.current,
      GetConnectedPlayers: () => connectedPlayersRef.current,      GetPlayer: (idOrObj) => {
        const id = idOrObj?.id ?? idOrObj;
        return playersRef.current.find((x) => x.id === id);
      },

      GetCurrentPlayer: () => {
        const player = currentPlayerRef?.current;
        return player ? playersRef.current.find((x) => x.id === player.id) : undefined;
      },

      GetCurrentPlayerColor: () => {
        const player = currentPlayerRef?.current;
        if (!player) return 'rgb(0,0,0,0)';
        const localPlayer = playersRef.current.find((x) => x.id === player.id);
        return localPlayer ? localPlayer.color : 'rgb(0,0,0,0)';
      },      // ── Game metadata ────────────────────────────────────────────────────────
      GetGameId: () => gameID,
      GetContainerRef: () => gameContainerRef,
      // gameRef is populated by useGameInitialization once the fetch completes.
      // Methods return undefined/null until then — no timing error.
      GetGame: () => gameRef.current,
      GetOwner: () => gameRef.current?.master?.id,
      GetIsGM: () => {
        const isAdmin = process.env.REACT_APP_MODE !== 'player';
        if (isAdmin) return true;
        return isGM;
      },
      GetRole: () => {
        const isAdmin = process.env.REACT_APP_MODE !== 'player';
        if (isAdmin) return ROLES.ADMIN;
        return isGM ? ROLES.GM : ROLES.PLAYER;
      },

      // ── Maps ─────────────────────────────────────────────────────────────────
      GetMaps: async () => await WebHelper.getAsync('map/GetAllFlat'),

      // ── Panels ───────────────────────────────────────────────────────────────
      CreateNewPanel: (allProps) => {
        const { type, props, battleMapId, isCommand, inWindow } = allProps;
        let finalProps = isCommand ? { ...allProps } : { ...props, battlemapId: battleMapId };

        const createdElement = CreateLayoutElement({
          type,
          syncId: battleMapId,
          props: { ...finalProps },
        });

        if (!createdElement && isCommand) return 'Wrong panel type';

        if (inWindow) {
          const NewWindow = require('../WindowsHandler').NewWindow;
          setPortaledPanels([
            ...portaledPanels,
            React.createElement(NewWindow, { key: UtilityHelper.GenerateUUID() }, createdElement),
          ]);
        } else {
          return DockableHelper.NewFloating(state, createdElement);
        }
      },

      // ── UI ───────────────────────────────────────────────────────────────────
      OpenRun: () => {
        if (quickCommandDialogOpenRef?.current) quickCommandDialogOpenRef.current();
      },

      // ── Lifecycle ────────────────────────────────────────────────────────────
      Exit: () => onExit(),

      // ── Entity permissions ───────────────────────────────────────────────────
      UpdateEntityPermission: ({ entityType, entityId, bits }) => {
        _entityPermissionSetter.current?.(entityType, entityId, bits ?? 0);
      },

      onEvent: (eventName, data) => {
        if (eventName === 'ActivePanelChanged' && data.panel === 'BattleMap') {
          setSelectedBattleMapId(data.contextId);
        }
      },
    };

    ClientMediator.register(gameApi);

    // Register the pop-out handler so Container.js can call it via DockableHelper
    const handlePopOut = (element, title, contentId) => {
      const id = `popout_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      setPortaledPanels(prev => [
        ...prev,
        React.createElement(BrowserWindowPortal, {
          key: id,
          title: title || 'Panel',
          contentId: contentId,
          onClose: () => setPortaledPanels(p => p.filter(x => x.key !== id)),
        }, element),
      ]);
    };
    DockableHelper.registerPopOutHandler(handlePopOut);

    // No cleanup / unregister — the Game client lives for the entire session.
    // Re-registration (same id) updates the client in place (see ClientMediator.register).
  }, [
    state,
    gameID,
    CreateLayoutElement,
    UpdateAfterTime,
    layout,
    playersRef,
    connectedPlayersRef,
    battleMapsContextsRef,
    battleMapContexts,
    setBattleMapContexts,
    setLayout,
    selectedBattleMapId,
    setSelectedBattleMapId,
    portaledPanels,
    setPortaledPanels,
    onExit,
    gameContainerRef,
    quickCommandDialogOpenRef,
    currentPlayerRef,
    isGM,
  ]);
};
