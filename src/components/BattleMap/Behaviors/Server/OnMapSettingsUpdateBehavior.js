import ClientMediator from "../../../../ClientMediator";

export class OnMapSettingsUpdateBehavior {
  Handle(response, canvas, battleMapId) {
    let dto = response.data;
    let mapId = ClientMediator.sendCommand("BattleMap", "GetSelectedMapID", {
      contextId: battleMapId,
    });
    if (mapId === dto.id) {
      ClientMediator.sendCommand("BattleMap", "ReloadBattleMapComponent", {
        contextId: battleMapId,
      });
    }
  }
}
