import ClientMediator from "../../../../ClientMediator";

export class OnMapSettingsUpdateBehavior {
  Handle(response, canvas, battleMapId) {
    let dto = response.data;
    console.log('OnMapSettingsUpdateBehavior: received settings_map', { dto, battleMapId });
    let mapId = ClientMediator.sendCommand("BattleMap", "GetSelectedMapID", {
      contextId: battleMapId,
    });
    console.log('OnMapSettingsUpdateBehavior: current mapId vs dto.id', { mapId, dtoId: dto.id });
    if (mapId === dto.id) {
      // Update the map reference directly with the new settings before reloading
      ClientMediator.sendCommand("BattleMap", "UpdateMapReference", {
        contextId: battleMapId,
        mapData: dto,
      });
      ClientMediator.sendCommand("BattleMap", "ReloadBattleMapComponent", {
        contextId: battleMapId,
      });
    }
  }
}
