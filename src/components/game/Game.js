import * as React from 'react';
import WebHelper from '../../helpers/WebHelper';
import Battlemap from '../BattleMap/Battlemap';
import WebSocketManagerInstance from './WebSocketManager';
import * as Dockable from "@hlorenzi/react-dockable"
import MainToolbar from './ToolBar/MainToolbar';
import GameDataManger from './GameDataManager';
import KeyboardEventsManager from './KeyBoardEventsManager';
import LayoutHelper from '../../helpers/LayoutCloneHelper';
import Subscribable from '../uiComponents/base/Subscribable';
import { API } from '../../API';
import { Flex } from '@chakra-ui/react';
import DockableHelper from '../../helpers/DockableHelper';
import PanelList from '../../helpers/PanelsList';
import ClientMediator from '../../ClientMediator';

export const BattleMapInstance = { battleMap: undefined };

export const Game = ({ gameID, onExit }) => {
  // States
  const [layout, setLayout] = React.useState(undefined);
  const [battleMapContexts, setBattleMapContexts] = React.useState({});
  const battleMapsContextsRef = React.useRef({});
  battleMapsContextsRef.current = battleMapContexts;
  //This is refresh after some time
  // to make all components load properly
  // Generally i will think how to make it better...
  const [_, forceUpdate] = React.useReducer((x) => x + 1, 0);
  const UpdateAfterTime = () => { setTimeout(forceUpdate, 100) }

  // References, these objects are user everywhere across the application
  const gameDataManagerRef = React.useRef(new GameDataManger());
  const keyboardEventsManagerRef = React.useRef(new KeyboardEventsManager());

  WebHelper.GameId = gameID;

  // Setting up dockable. when dockable is loading we start websocketManagerInstance
  const state = Dockable.useDockable((state) => {

  });

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

    createdElement = React.createElement(PanelList[content.type], props);

    return createdElement;
  }

  const SetLayoutAndApply = (layout) => {
    LayoutHelper.LoadLayoutState(state, layout.value, CreateLayoutElement);
    setLayout(layout);
  }

  const HandleShowLayout = (resp) => {
    WebHelper.get(`battlemap/GetLayout?id=${resp.data}`, SetLayoutAndApply);
  }

  const HandleSettingsChange = (resp) => {
    if (resp.command === "settings_player") {
      let player = gameDataManagerRef.current.Game.players.find(x => x.id === resp.data.id);
      if (player) {
        player.name = resp.data.name;
        player.color = resp.data.color;
        player.image = resp.data.image;
        forceUpdate();
      }
    }
  }

  const HandlePlayers = (resp) => {
    switch (resp.command) {
      case "player_list":
        gameDataManagerRef.current.ConnectedPlayers = resp.data;
        break;
      case "player_join":
        if (!gameDataManagerRef.current.ConnectedPlayers.find(x => x.id === resp.data.id)) {
          gameDataManagerRef.current.ConnectedPlayers.push(resp.data);
        }
        if (!gameDataManagerRef.current.Game.players.find(x => x.id === resp.data.id)) {
          gameDataManagerRef.current.Game.players.push(resp.data);
        }
        break;
      case "player_leave":
        gameDataManagerRef.current.ConnectedPlayers = gameDataManagerRef.current.ConnectedPlayers.filter(x => x.id !== resp.data.id);
        break;
      case "player_kick":
        gameDataManagerRef.current.ConnectedPlayers = gameDataManagerRef.current.ConnectedPlayers.filter(x => x.id !== resp.data);
        gameDataManagerRef.current.Game.players = gameDataManagerRef.current.Game.players.filter(x => x.id !== resp.data);
        if (gameDataManagerRef.current.CurrentPlayerId === resp.data) {
          onExit();
        }
        break;
      default:
        break;
    }

    ClientMediator.fireEvent("PlayersChanged", {});
  }

  const HandleShowBattleMap = (resp) => {
    let context = battleMapContexts.current[resp.data];
    if (context === undefined) {
      let panel = DockableHelper.NewFloating(state, CreateLayoutElement({ type: "Battlemap", syncId: resp.data }));
      panel.rect = panel.rect.withX(50).withY(50);
      state.commit();
    }
  }

  const HandleShowPanel = (resp) => {
    let panel = DockableHelper.NewFloating(state, CreateLayoutElement(resp.data));
    panel.rect = panel.rect.withX(50).withY(50);
    state.commit();
  }


  React.useEffect(() => {
    if (!WebSocketManagerInstance.WebSocketStarted) {
      return;
    }
    API.Client._state = state;
    API.Client._createLayoutElement = CreateLayoutElement;
    //WebSocketManagerInstance.ClearSubscription();
    WebHelper.get(`battlemap/getplayer`, x => { gameDataManagerRef.current.CurrentPlayerId = x.id });
    //Load everything when we have full game only
    WebHelper.get(`battlemap/getfullgame`, x => {
      //Assign data to GameDataManagerInstance. its used in all panels.
      gameDataManagerRef.current.Load(x);

      const gameMethods = {
        SetLayout: SetLayoutAndApply,
        update: UpdateAfterTime,
        CreateLayoutElement: CreateLayoutElement,
        AddBattleMapContext: (battleMapContext) => {
          let newBmContexts = { ...battleMapsContextsRef.current };
          newBmContexts[battleMapContext.Id] = battleMapContext;
          setBattleMapContexts(newBmContexts);
          ClientMediator.fireEvent("BattleMapsChanged", newBmContexts);
        },
        GetBattleMapContext: (id) => battleMapContexts[id],
        DeleteBattleMapContext: (id) => {
          let newBmContexts = { ...battleMapsContextsRef.current };
          delete newBmContexts[id];
          setBattleMapContexts(newBmContexts)
          ClientMediator.fireEvent("BattleMapsChanged", newBmContexts);
        },
        GetOpenedBattleMaps: () => Object.values(battleMapContexts),
        GetMaps: () => gameDataManagerRef.current.Game.maps,
        GetPlayers: () => gameDataManagerRef.current.Game.players,
        GetConnectedPlayers: () => gameDataManagerRef.current.GetConnectedPlayers(),
        GetCurrentPlayer: () => gameDataManagerRef.current.CurrentPlayer(),
        GetGame: () => gameDataManagerRef.current.Game,
        GetLayout: () => layout,
        CreateNewPanel: ({type, props, battleMapId}) => {
          let createdElement = CreateLayoutElement({ type, syncId: battleMapId, props: { ...props } });
          let panel = DockableHelper.NewFloating(state, createdElement);
          return panel;
        },
      };

      ClientMediator.register({ id: "Game", panel: "Game", ...gameMethods });

      setLayout(gameDataManagerRef.current.Game.defaultLayout);
      LayoutHelper.LoadLayoutState(state, gameDataManagerRef.current.Game.defaultLayout.value, CreateLayoutElement);
      
      ClientMediator.fireEvent("BattleMapsChanged", gameDataManagerRef.current.Game.battleMaps);

      WebSocketManagerInstance.Send({ command: "player_list" });
    });

  }, [WebSocketManagerInstance.WebSocketStarted]);

  if (!WebSocketManagerInstance.WebSocketStarted) {
    WebSocketManagerInstance.Start(gameID);
    return <>
      Loading :)
    </>
  }

  API.Client._createLayoutElement = CreateLayoutElement;
  API.Client._state = state;
  API.Client._gameDataManagerRef = gameDataManagerRef;
  API.Client._keyboardEventsManagerRef = keyboardEventsManagerRef;
  API.Client._exitGame = onExit;

  //To refactor toolbar. it will be in Toolbar directory probably. but i need to make map system and write tools panel properly.
  return (
    <div style={{ display: "grid", gridTemplate: "auto-flow  / 1fr 1fr", width: "100%" }} onKeyDown={(e) => keyboardEventsManagerRef.current.HandleKeyboardEventDown(e)} onKeyUp={(e) => keyboardEventsManagerRef.current.HandleKeyboardEventUp(e)}>

      <Subscribable onMessage={HandleShowLayout} commandPrefix={"layout_forcechange"} />
      <Subscribable onMessage={HandleSettingsChange} commandPrefix={"settings"} />
      <Subscribable onMessage={HandlePlayers} commandPrefix={"player"} />
      <Subscribable onMessage={HandleShowBattleMap} commandPrefix={"battlemap_show"} />
      <Subscribable onMessage={HandleShowPanel} commandPrefix={"show_panel"} />
      {/* <Subscribable onMessage={HandleShowLayout} commandPrefix={"panel_show"} /> */}
      <MainToolbar state={state}
        gameDataManagerRef={gameDataManagerRef}
        battlemapsRef={battleMapContexts}
        forceRefreshGame={forceUpdate} />
      <Flex className='content'>
        <Dockable.Container state={state} />
      </Flex>

    </div>
  )
}
export default Battlemap;