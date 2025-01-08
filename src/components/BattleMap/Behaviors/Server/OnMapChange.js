import ClientMediator from "../../../../ClientMediator";

export class OnMapChangeBehavior {
    Handle({ data }, canvas, battleMapId) {
        if (battleMapId === data.id) {
            let mapId = data.mapId;
            ClientMediator.sendCommand("BattleMap","ChangeMap", {contextId: battleMapId, id: mapId});
        }
    }
}