import ClientMediator from "../../../../ClientMediator";

export class OnMapChangeBehavior {
    Handle({ data }, canvas, battleMapId) {
        if (battleMapId === data.id) {
            let id = data.mapId;
            ClientMediator.sendCommand("BattleMap","ChangeMap", {contextId: battleMapId, id: id});
        }
    }
}