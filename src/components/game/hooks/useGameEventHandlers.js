import React, { useCallback } from 'react';
import UtilityHelper from '../../../helpers/UtilityHelper';
import DockableHelper from '../../../helpers/DockableHelper';
import ClientMediator from '../../../ClientMediator';
import WebHelper from '../../../helpers/WebHelper';
import { toaster } from '../../ui/toaster';
import ClientScript from '../../uiComponents/ClientScript';

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
    setClientScripts,
    clientScripts,
    battleMapContexts,
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

  const HandleShowBattleMap = useCallback((resp) => {
    const context = battleMapContexts.current[resp.data];
    if (context === undefined) {
      const panel = DockableHelper.NewFloating(
        state,
        CreateLayoutElement({ type: "Battlemap", syncId: resp.data })
      );
      panel.rect = panel.rect.withX(50).withY(50);
      state.commit();
    }
  }, [battleMapContexts, state, CreateLayoutElement]);

  const HandleShowPanel = useCallback((resp) => {
    const panel = DockableHelper.NewFloating(
      state,
      CreateLayoutElement(resp.data)
    );
    panel.rect = panel.rect.withX(50).withY(50);
    state.commit();
  }, [state, CreateLayoutElement]);

  const HandleExecuteClientScript = useCallback(async (resp) => {
    await WebHelper.getAsync(
      `addon/confirmscriptrequest?id=${resp.data.requestId}`
    );

    if (clientScripts?.find((x) => x.key === resp.data.script)) {
      return;
    }    setClientScripts([
      ...clientScripts,
      {
        key: resp.data.script,
        value: React.createElement(ClientScript, { 
          key: resp.data.script, 
          script: resp.data.script 
        }),
      },
    ]);
  }, [clientScripts, setClientScripts]);
  return {
    HandleShowLayout,
    HandleSettingsChange,
    HandleError,
    HandlePlayers,
    HandleShowBattleMap,
    HandleShowPanel,
    HandleExecuteClientScript
  };
};
