import * as React from "react";
import WebHelper from "../../helpers/WebHelper";
import Battlemap from "../BattleMap/Battlemap";
import WebSocketManagerInstance from "./WebSocketManager";
import * as Dockable from "@hlorenzi/react-dockable";
import MainToolbar from "./ToolBar/MainToolbar";
import GameDataManger from "./GameDataManager";
import KeyboardEventsManager from "./KeyBoardEventsManager";
import LayoutHelper from "../../helpers/LayoutCloneHelper";
import Subscribable from "../uiComponents/base/Subscribable";
import CardAPI, { API } from "../../CardAPI";
import { Flex, Toast, useToast } from "@chakra-ui/react";
import DockableHelper from "../../helpers/DockableHelper";
import PanelList from "../../helpers/PanelsList";
import ClientMediator from "../../ClientMediator";
import QuickCommandDialog from "../QuickCommandDialog";
import PropertiesHelperInstance from "../../helpers/PropertiesHelper";
import UtilityHelper from "../../helpers/UtilityHelper";
import ScriptAPI from "../../ScriptAPI";
import ClientScript from "../uiComponents/ClientScript";
import { NewWindow } from "./WindowsHandler";
import PlayersPanel from "./panels/PlayersPanel";
import { useInstantLayoutTransition } from "framer-motion";

export const BattleMapInstance = { battleMap: undefined };

export const Game = ({ gameID, onExit }) => {
  // States
  const [layout, setLayout] = React.useState(undefined);
  const [battleMapContexts, setBattleMapContexts] = React.useState({});
  const [portaledPanels, setPortaledPanels] = React.useState([]);
  const battleMapsContextsRef = React.useRef({});
  const quickCommandDialogOpenRef = React.useRef(null);

  const [clientScripts, setClientScripts] = React.useState([]);

  const toast = useToast();

  battleMapsContextsRef.current = battleMapContexts;
  //This is refresh after some time
  // to make all components load properly
  // Generally i will think how to make it better...
  const [_, forceUpdate] = React.useReducer((x) => x + 1, 0);
  const UpdateAfterTime = () => {
    setTimeout(forceUpdate, 100);
  };

  // References, these objects are user everywhere across the application
  const gameDataManagerRef = React.useRef(new GameDataManger());
  const keyboardEventsManagerRef = React.useRef(new KeyboardEventsManager());

  WebHelper.GameId = gameID;

  // Setting up dockable. when dockable is loading we start websocketManagerInstance
  const state = Dockable.useDockable((state) => {});

  // // GetSelectedBattleMapContext uses contexts to find which battlemap is selected. Its used for keyboard events
  // keyboardEventsManagerRef.current._getSelectedBattleMapContext = () => {
  //   let filteredBattleMaps = Object.values(battleMapsContexts.current).filter(x =>
  //     x.current.Panel.id === state.ref.current.activePanel.id
  //   );
  //   if (filteredBattleMaps.length > 0) {
  //     return filteredBattleMaps[0];
  //   }
  //   return undefined;
  // }

  // This method is purely used in layouts. To restore layouts we need to create types that was used before. Its here because here are most important references
  // Can bew refactored though. maybe we can move it to another place
  const CreateLayoutElement = (content) => {
    let createdElement = undefined;

    const props = {
      ...content.props,
      gameDataManagerRef,
      state,
      keyboardEventsManagerRef,
      syncId: content.syncId || content.props?.syncId || undefined,
      withID: content.syncId,
    };

    if (!PanelList[content.type]) {
      console.error(`Panel type ${content.type} is not defined`);
      return null;
    }

    createdElement = React.createElement(PanelList[content.type], props);

    return createdElement;
  };

  const SetLayoutAndApply = (layout) => {
    state.ref.current.rootPanel = undefined;
    LayoutHelper.LoadLayoutState(state, layout.value, CreateLayoutElement);
    setLayout(layout);
  };

  const HandleShowLayout = (resp) => {
    WebHelper.get(`battlemap/GetLayout?id=${resp.data}`, SetLayoutAndApply);
  };

  const HandleSettingsChange = (resp) => {
    if (resp.command === "settings_player") {
      let player = gameDataManagerRef.current.Game.players.find(
        (x) => x.id === resp.data.id
      );
      if (player) {
        player.name = resp.data.name;
        player.color = resp.data.color;
        player.image = resp.data.image;
        forceUpdate();
      }
    }
  };

  const HandleError = (resp) => {
    switch (resp.command) {
      case "error_permission":
        let t = UtilityHelper.GenerateErrorToast("No Permissions!", resp.data);
        toast(t);
        break;
      case "error_arguments":
        let t1 = UtilityHelper.GenerateErrorToast("Wrong arguments usage", resp.data);
        toast(t1);
        break;
      case "error_resource":
        let t2 = UtilityHelper.GenerateErrorToast("No resource found", resp.data);
        toast(t2);
        break;
      default:
        ClientMediator.sendCommand("Game","CreateNewPanel", { type: "LookupPanel", props: { title: "Error", content: resp.data } });
        let t3 = UtilityHelper.GenerateErrorToast("Error!", resp.data);
        toast(t3);
        break;
    }
  }

  const HandlePlayers = (resp) => {
    switch (resp.command) {
      case "player_list":
        gameDataManagerRef.current.ConnectedPlayers = resp.data;
        break;
      case "player_join":
        if (
          !gameDataManagerRef.current.ConnectedPlayers.find(
            (x) => x.id === resp.data.id
          )
        ) {
          gameDataManagerRef.current.ConnectedPlayers.push(resp.data);
        }
        if (
          !gameDataManagerRef.current.Game.players.find(
            (x) => x.id === resp.data.id
          )
        ) {
          gameDataManagerRef.current.Game.players.push(resp.data);
        }
        break;
      case "player_leave":
        gameDataManagerRef.current.ConnectedPlayers =
          gameDataManagerRef.current.ConnectedPlayers.filter(
            (x) => x.id !== resp.data.id
          );
        break;
      case "player_kick":
        gameDataManagerRef.current.ConnectedPlayers =
          gameDataManagerRef.current.ConnectedPlayers.filter(
            (x) => x.id !== resp.data
          );
        gameDataManagerRef.current.Game.players =
          gameDataManagerRef.current.Game.players.filter(
            (x) => x.id !== resp.data
          );
        if (gameDataManagerRef.current.CurrentPlayerId === resp.data) {
          onExit();
        }
        break;
      default:
        break;
    }

    ClientMediator.fireEvent("PlayersChanged", {});
  };

  const HandleShowBattleMap = (resp) => {
    let context = battleMapContexts.current[resp.data];
    if (context === undefined) {
      let panel = DockableHelper.NewFloating(
        state,
        CreateLayoutElement({ type: "Battlemap", syncId: resp.data })
      );
      panel.rect = panel.rect.withX(50).withY(50);
      state.commit();
    }
  };

  const HandleShowPanel = (resp) => {
    let panel = DockableHelper.NewFloating(
      state,
      CreateLayoutElement(resp.data)
    );
    panel.rect = panel.rect.withX(50).withY(50);
    state.commit();
  };

  const HandleExecuteClientScript = async (resp) => {
    const checkResult = await WebHelper.getAsync(
      `addon/confirmscriptrequest?id=${resp.data.requestId}`
    );

    //if (!checkResult || !checkResult.result) {
    //  return;
    //}

    if (clientScripts?.find((x) => x.key === resp.data.script)) {
      return;
    }

    setClientScripts([
      ...clientScripts,
      {
        key: resp.data.script,
        value: (
          <ClientScript key={resp.data.script} script={resp.data.script} />
        ),
      },
    ]);
  };

  React.useEffect(() => {
    if (!WebSocketManagerInstance.WebSocketStarted) {
      return;
    }

    //WebSocketManagerInstance.ClearSubscription();
    WebHelper.get(`battlemap/getplayer`, (x) => {
      gameDataManagerRef.current.CurrentPlayerId = x.id;
    });
    //Load everything when we have full game only
    WebHelper.get(`battlemap/getfullgame`, (x) => {
      //Assign data to GameDataManagerInstance. its used in all panels.
      gameDataManagerRef.current.Load(x);

      const gameMethods = {
        SetLayout: SetLayoutAndApply,
        update: UpdateAfterTime,
        CreateLayoutElement: CreateLayoutElement,
        AddBattleMapContext: ({ battleMapContext }) => {
          let newBmContexts = { ...battleMapsContextsRef.current };
          newBmContexts[battleMapContext.Id] = battleMapContext;
          setBattleMapContexts(newBmContexts);
          ClientMediator.fireEvent("BattleMapsChanged", newBmContexts);
        },
        GetBattleMapContext: ({ id }) => battleMapContexts[id],
        DeleteBattleMapContext: ({ id }) => {
          let newBmContexts = { ...battleMapsContextsRef.current };
          delete newBmContexts[id];
          setBattleMapContexts(newBmContexts);
          ClientMediator.fireEvent("BattleMapsChanged", newBmContexts);
        },
        GetOpenedBattleMaps: () => Object.values(battleMapsContextsRef.current),
        GetMaps: () => gameDataManagerRef.current.Game.maps,
        GetPlayers: () => gameDataManagerRef.current.Game.players,
        GetConnectedPlayers: () =>
          gameDataManagerRef.current.GetConnectedPlayers(),
        GetCurrentPlayer: () => gameDataManagerRef.current.CurrentPlayer(),
        GetGame: () => gameDataManagerRef.current.Game,
        GetLayout: () => layout,
        CreateNewPanel: (allProps) => {
          const { type, props, battleMapId, isCommand, inWindow } = allProps;
          let finalProps = { ...props, battlemapId: battleMapId };
          if (isCommand) {
            finalProps = { ...allProps };
          }

          let createdElement = CreateLayoutElement({
            type,
            syncId: battleMapId,
            props: { ...finalProps },
          });

          if (!createdElement && isCommand) {
            return "Wrong panel type";
          }
          if (inWindow) {
            let newPortales = [...portaledPanels];
            newPortales.push(<NewWindow key={UtilityHelper.GenerateUUID()}>{createdElement}</NewWindow>);
            setPortaledPanels(newPortales);
          } else {
            let panel = DockableHelper.NewFloating(state, createdElement);
            return panel;
          }
        },
        OpenRun() {
          quickCommandDialogOpenRef.current();
        },
        GetCurrentPlayerColor: () => {
          let player = gameDataManagerRef.current.CurrentPlayer();
          return player ? player.color : "black";
        },
        Exit: () => {
          onExit();
        },
      };

      ClientMediator.register({ id: "Game", panel: "Game", ...gameMethods });

      setLayout(gameDataManagerRef.current.Game.defaultLayout);
      LayoutHelper.LoadLayoutState(
        state,
        gameDataManagerRef.current.Game.defaultLayout.value,
        CreateLayoutElement
      );

      ClientMediator.fireEvent(
        "BattleMapsChanged",
        gameDataManagerRef.current.Game.battleMaps
      );

      ClientMediator.register(PropertiesHelperInstance);
      WebSocketManagerInstance.Send({ command: "player_list" });

      //Attach API methods
      window.CreateCardAPI = CardAPI;
      window.ScriptAPI = ScriptAPI;
      DockableHelper.State = state;

      WebSocketManagerInstance.Send({ command: "client_loaded" });
    });
  }, [WebSocketManagerInstance.WebSocketStarted]);

  if (!WebSocketManagerInstance.WebSocketStarted) {
    WebSocketManagerInstance.Start(gameID);
    return <>Loading :)</>;
  }

  //To refactor toolbar. it will be in Toolbar directory probably. but i need to make map system and write tools panel properly.
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "35px calc(100vh - 35px)",
      }}
      onKeyDown={(e) =>
        keyboardEventsManagerRef.current.HandleKeyboardEventDown(e)
      }
      onKeyUp={(e) => keyboardEventsManagerRef.current.HandleKeyboardEventUp(e)}
    >
      <Subscribable
        onMessage={HandleShowLayout}
        commandPrefix={"layout_forcechange"}
      />
      <Subscribable
        onMessage={HandleSettingsChange}
        commandPrefix={"settings"}
      />
      <Subscribable onMessage={HandlePlayers} commandPrefix={"player"} />
      <Subscribable
        onMessage={HandleExecuteClientScript}
        commandPrefix={"clientscript_execute"}
      />
      <Subscribable
        onMessage={HandleShowBattleMap}
        commandPrefix={"battlemap_show"}
      />
      <Subscribable
        onMessage={HandleError}
        commandPrefix={"error"}
      />
      <Subscribable onMessage={HandleShowPanel} commandPrefix={"show_panel"} />
      {/* <Subscribable onMessage={HandleShowLayout} commandPrefix={"panel_show"} /> */}
      <MainToolbar
        key={gameID}
        state={state}
        gameDataManagerRef={gameDataManagerRef}
        battlemapsRef={battleMapContexts}
        forceRefreshGame={forceUpdate}
      />
      <Flex>
        <Dockable.Container state={state} />
      </Flex>
      <QuickCommandDialog state={state} openRef={quickCommandDialogOpenRef} />
      {portaledPanels}
      {clientScripts.map((x) => x.value)}
    </div>
  );
};
export default Battlemap;
