import { Show } from "@chakra-ui/react";
import CommandFactory from "./components/BattleMap/Factories/CommandFactory";
import WebSocketManagerInstance from "./components/game/WebSocketManager";
import DockableHelper from "./helpers/DockableHelper";

export const API = {
    Server: {
        BattleMapUpdate: (element, battleMapId, action) => {
            WebSocketManagerInstance.Send(CommandFactory.CreateBattleMapUpdateCommand(element, battleMapId, action));
        },
        // UpdateElement: (element, battleMapContext, action) => {
        //     WebSocketManagerInstance.Send(CommandFactory.CreateUpdateCommand(element,action));
        // },

        AddElement: (element, withSelection) => {
            WebSocketManagerInstance.Send(CommandFactory.CreateAddCommand(element, withSelection));
        },
        DeleteElement: (element) => {
            WebSocketManagerInstance.Send(CommandFactory.CreateDeleteCommand(element));
        },
        Group: (group, elementIds) => {
            let cmd = CommandFactory.CreateGroupCommand(group, elementIds);
            WebSocketManagerInstance.Send(cmd);
        },
        Ungroup: (id, elements) => {
            let cmd = CommandFactory.CreateUngroupCommand(id, elements);
            WebSocketManagerInstance.Send(cmd);
        },
        ChatSend: (message) => {
            WebSocketManagerInstance.Send(CommandFactory.CreateChatSendCommand(message));
        },
        SetMapSettings: (dto) => {
            WebSocketManagerInstance.Send(CommandFactory.CreateMapSettingsCommand(dto));
        },
        SetGameSettings: (dto) => {
            WebSocketManagerInstance.Send(CommandFactory.CreateGameSettingsCommand(dto));
        },
        SetPlayerSettings: (dto) => {
            WebSocketManagerInstance.Send(CommandFactory.CreatePlayerSettingsCommand(dto));
        },
        ChangeMap: (mapId, battleMapId) => {
            WebSocketManagerInstance.Send(CommandFactory.CreateChangeMapCommand(mapId, battleMapId));
        },
        MapRemove: (mapId) => {
            WebSocketManagerInstance.Send(CommandFactory.CreateMapRemoveCommand(mapId));
        },
        MapAdd: () => {
            WebSocketManagerInstance.Send(CommandFactory.CreateMapAddCommand());
        },
        LayoutAdd: (layout) => {
            WebSocketManagerInstance.Send(CommandFactory.CreateLayoutAddCommand(layout));
        },
        LayoutUpdate: (layout) => {
            WebSocketManagerInstance.Send(CommandFactory.CreateLayoutUpdateCommand(layout));
        },
        LayoutRemove: (id) => {
            WebSocketManagerInstance.Send(CommandFactory.CreateLayoutRemoveCommand(id));
        },
        LayoutForce: (id) => {
            WebSocketManagerInstance.Send(CommandFactory.CreateLayoutForceCommand(id));
        },
        DeleteBattleMap: (id) => {
            WebSocketManagerInstance.Send(CommandFactory.CreateDeleteBattleMap(id));
        },
        RenameBattleMap: (id, name) => {
            WebSocketManagerInstance.Send(CommandFactory.RenameBattleMap(id, name));
        },
        ShowBattleMap: (battleMapContext) => {
            WebSocketManagerInstance.Send(CommandFactory.CreateShowBattleMapCommand(battleMapContext));
        }
    },
    Client: {
        _battleMapsContexts: undefined,
        _createLayoutElement: undefined,
        _state: undefined,
        _keyboardEventsManagerRef: undefined,
        _gameDataManagerRef: undefined,
        _exitGame: undefined,

        LoadContexts: undefined,

        LoadContext(element)
        {
            let context = API.Client._battleMapsContexts.find(x=>x.id == element.syncId);
            element.props = { ...element.props, bmContext: context };
        },

        GetAllBattleMaps() {
            return API.Client._battleMapsContexts;
        },

        GetBattleMap(id) {
            return API.Client._battleMapsContexts.find(x=>x.id == id);
        },
        
        CreateNewPanel(type, battlemapId, props, bmContext) {
            let createdElement = API.Client._createLayoutElement({ type, syncId: battlemapId, props:{...props, bmContext} });
            let panel = DockableHelper.NewFloating(API.Client._state, createdElement);
            return panel;
        },
        ExitGame() {
            API.Client._exitGame();
        },
        CopySelectedElement(battleMapContext) {
            battleMapContext.current.BattleMapServices.BMService.CopyElements();
        },
        PasteSelectedElement(battleMapContext,coords) {
            battleMapContext.current.BattleMapServices.BMService.PasteElements(coords);
        }
    }
}
