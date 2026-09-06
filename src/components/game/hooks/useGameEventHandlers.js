import React, { useCallback } from 'react';
import UtilityHelper from '../../../helpers/UtilityHelper';
import DockableHelper from '../../../helpers/DockableHelper';
import ClientMediator from '../../../ClientMediator';
import { toaster } from '../../ui/toaster';
import { DropDownItem } from '../../uiComponents/base/DDItems/DropDownItem';

/**
 * Custom hook for managing game-specific WebSocket event handlers
 */
export const useGameEventHandlers = ({ state, gameState, CreateLayoutElement }) => {
  const {
    playersRef,
    connectedPlayersRef,
    currentPlayerId,
    onExit,
    setPlayers,
    setConnectedPlayers,
    battleMapsContextsRef,
  } = gameState;

  const HandleShowLayout = useCallback((resp) => {
    // Route through the Game API so the single registered handler runs
    ClientMediator.sendCommand('Game', 'SetLayout', resp.data);
  }, []);

  const HandleSettingsChange = useCallback((resp) => {
    if (resp.command === "settings_player") {
      const newPlayers = playersRef.current;
      const playerIndex = newPlayers.findIndex((x) => x.id === resp.data.id);
      if (playerIndex > -1) {
        newPlayers[playerIndex] = { ...newPlayers[playerIndex], ...resp.data };
        setPlayers([...newPlayers]);
      }

      const newConnectedPlayers = connectedPlayersRef.current;
      const connectedPlayerIndex = newConnectedPlayers.findIndex(
        (x) => x.id === resp.data.id
      );
      if (connectedPlayerIndex > -1) {
        newConnectedPlayers[connectedPlayerIndex] = {
          ...newConnectedPlayers[connectedPlayerIndex],
          ...resp.data,
        };
        setConnectedPlayers([...newConnectedPlayers]);
      }

      ClientMediator.fireEvent("PlayersChanged", {
        connected: newConnectedPlayers,
        all: newPlayers
      });
    }
  }, [playersRef, connectedPlayersRef, setPlayers, setConnectedPlayers]);

  const HandleError = useCallback((resp) => {
    let toast;
    
    switch (resp.command) {
      case "error_permission":
        toast = UtilityHelper.GenerateErrorToast("No Permissions!", resp.data);
        break;
      case "error_arguments":
        toast = UtilityHelper.GenerateErrorToast("Wrong arguments usage", resp.data);
        break;
      case "error_resource":
        toast = UtilityHelper.GenerateErrorToast("No resource found", resp.data);
        break;
      default:
        ClientMediator.sendCommand("Game", "CreateNewPanel", {
          type: "LookupPanel",
          props: { title: "Error", content: resp.data },
        });
        toast = UtilityHelper.GenerateErrorToast("Error!", resp.data);
        break;
    }
    
    toaster.create(toast);
  }, []);

  const HandlePlayers = useCallback((resp) => {
    let connectedPlayers = connectedPlayersRef.current;
    let players = playersRef.current;

    switch (resp.command) {
      case "player_list":
        setConnectedPlayers(resp.data);
        break;
      case "player_join":
        if (!connectedPlayers.find((x) => x.id === resp.data.id)) {
          connectedPlayers = [...connectedPlayers, resp.data];
          setConnectedPlayers(connectedPlayers);
        }
        if (!players.find((x) => x.id === resp.data.id)) {
          players = [...players, resp.data];
          setPlayers(players);
        }
        break;
      case "player_leave":
        connectedPlayers = connectedPlayers.filter((x) => x.id !== resp.data.id);
        setConnectedPlayers(connectedPlayers);
        break;
      case "player_kick":
        connectedPlayers = connectedPlayers.filter((x) => x.id !== resp.data);
        players = playersRef.current.filter((x) => x.id !== resp.data);
        setConnectedPlayers(connectedPlayers);
        setPlayers(players);

        if (currentPlayerId === resp.data) {
          onExit();
        }
        break;
      default:
        break;
    }

    ClientMediator.fireEvent("PlayersChanged", {
      connected: connectedPlayers,
      all: players
    });
  }, [connectedPlayersRef, playersRef, setConnectedPlayers, setPlayers, currentPlayerId, onExit]);

  const HandleShowPanel = useCallback((resp) => {
    // Battlemap panels deduplicate — don't re-open if already registered.
    if (resp.data?.type === 'Battlemap') {
      const syncId = resp.data.syncId;
      if (syncId && battleMapsContextsRef.current[syncId]) return;
    }
    const panel = DockableHelper.NewFloating(state, CreateLayoutElement(resp.data));
    panel.rect = panel.rect.withX(50).withY(50);
    state.commit();
  }, [battleMapsContextsRef, state, CreateLayoutElement]);

  /** GM → player: show a specific card as a floating panel. */
  const HandleShowCard = useCallback((resp) => {
    const panel = DockableHelper.NewFloating(
      state,
      CreateLayoutElement({ type: "CardPanel", props: resp.data })
    );
    panel.rect = panel.rect.withX(50).withY(50);
    state.commit();
  }, [state, CreateLayoutElement]);

  /**
   * GM → player: show a view (also backed by CardPanel / same API as a card,
   * but intentionally excluded from the CardsPanel listing).
   */
  const HandleShowView = useCallback((resp) => {
    const panel = DockableHelper.NewFloating(
      state,
      CreateLayoutElement({ type: "CardPanel", props: resp.data })
    );
    panel.rect = panel.rect.withX(50).withY(50);
    state.commit();
  }, [state, CreateLayoutElement]);

  /**
   * Backend → client: show a view (card) by viewId.
   * Payload: { viewId: string, data?: string }
   */
  const HandleViewShow = useCallback((resp) => {
    const panel = DockableHelper.NewFloating(
      state,
      CreateLayoutElement({ type: "CardPanel", props: { id: resp.data.viewId, data: resp.data.data } })
    );
    panel.rect = panel.rect.withX(50).withY(50);
    state.commit();
  }, [state, CreateLayoutElement]);

  /**
   * Waits until a DropDownMenu with the given viewId has registered with
   * ClientMediator, resolving immediately if it already has. Plain
   * ClientMediator.sendCommand("DropDownMenu", ...) silently drops the message
   * if nothing is registered yet for that contextId (it doesn't queue), and
   * waitForEvent alone only catches *future* "DropDownMenuReady" firings — it
   * hangs forever if the target registered (and fired ready) before this runs.
   * Lazily-mounted targets (e.g. the battlemap right-click menu's "Add"
   * submenu, only mounted once a battlemap panel exists) need both checks.
   */
  const whenDropDownMenuReady = useCallback((viewId) => {
    const existing = ClientMediator._resolveClients
      ? ClientMediator._resolveClients("DropDownMenu", { contextId: viewId })
      : null;
    if (existing && existing.length > 0) return Promise.resolve();
    return ClientMediator.waitForEvent("DropDownMenuReady", (data) => data.viewId === viewId, 5000);
  }, []);

  /**
   * Backend → client: add a dynamic menu item to a named dropdown menu.
   * Payload: { name, uiName, icon, action, location, onlyOwner }
   */
  const HandleAddMenuItem = useCallback((resp) => {
    const item = resp.data;

    // If a submenu is requested, ensure a DropDownMenu is created inside the parent first
    if (item.subMenuId) {

      whenDropDownMenuReady(item.subMenuId)
        .then(() => {
          const menuItem = React.createElement(DropDownItem, {
            key: item.name,
            name: item.uiName || item.name,
            onClick: () => ClientMediator.sendCommand("Action", "Run", { name: item.action, args: item.actionArgs ?? undefined }),
          });
          ClientMediator.sendCommand("DropDownMenu", "AddMenuItem", {
            contextId: item.subMenuId,
            item: menuItem,
          });
        })
        .catch((e) => console.warn(`HandleAddMenuItem: submenu "${item.subMenuId}" never became ready`, e));

      whenDropDownMenuReady(item.location || "game")
        .then(() => {
          ClientMediator.sendCommand("DropDownMenu", "AddSubMenu", {
            contextId: item.location || "game",
            subMenuId: item.subMenuId,
            subMenuName: item.subMenuName || item.subMenuId,
          });
        })
        .catch((e) => console.warn(`HandleAddMenuItem: parent menu "${item.location || "game"}" never became ready`, e));

      }
      else {
        const targetContextId = item.subMenuId || item.location || "game";
        whenDropDownMenuReady(targetContextId)
          .then(() => {
            const menuItem = React.createElement(DropDownItem, {
              key: item.name,
              name: item.uiName || item.name,
              onClick: () => ClientMediator.sendCommand("Action", "Run", { name: item.action, args: item.actionArgs ?? undefined }),
            });
            ClientMediator.sendCommand("DropDownMenu", "AddMenuItem", {
              contextId: targetContextId,
              item: menuItem,
            });
          })
          .catch((e) => console.warn(`HandleAddMenuItem: menu "${targetContextId}" never became ready`, e));
  }
  }, [whenDropDownMenuReady]);

  /**
   * Backend → client: add a dynamic button to the toolbar.
   * Payload: { name, uiName, icon, action, location, onlyOwner, menuId, menuName }
   */
  const HandleAddToolbarButton = useCallback((resp) => {
    const item = resp.data;
    ClientMediator.sendCommand("Toolbar", "AddButton", {
      name: item.uiName || item.name,
      menuId: item.menuId,
      menuName: item.menuName,
      onClick: () => ClientMediator.sendCommand("Action", "Run", { name: item.action, args: item.actionArgs ?? undefined }),
    });
  }, []);

  /**
   * Backend → client: fire a ClientMediator event.
   * Payload: { eventName: string, payload?: any }
   */
  const HandleFireClientMediator = useCallback((resp) => {
    ClientMediator.fireEvent(resp.data.eventName, resp.data.payload);
  }, []);

  return {
    HandleShowLayout,
    HandleSettingsChange,
    HandleError,
    HandlePlayers,
    HandleShowPanel,
    HandleShowCard,
    HandleShowView,
    HandleViewShow,
    HandleAddMenuItem,
    HandleAddToolbarButton,
    HandleFireClientMediator,
  };
};
