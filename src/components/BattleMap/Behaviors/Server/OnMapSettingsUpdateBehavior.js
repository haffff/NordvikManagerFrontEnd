import ClientMediator from "../../../../ClientMediator";

export class OnMapSettingsUpdateBehavior {
    Handle(response, canvas, battleMapId) {
        let dto = response.data;
        let mapId = ClientMediator.sendCommand("BattleMap","GetSelectedMapID", {contextId: battleMapId});
        if (mapId === dto.id) {
            //let map = ClientMediator.sendCommandWaitForRegister("BattleMap","GetMap", { id: dto.id }, true).then((map) => {
                // Object.keys(response.data).forEach(key => {
                //     if (dto[key] !== undefined && dto[key] !== "" && dto[key] !== null) {
                //         map[key] = dto[key];
                //     }
                // });
                
            //});
            ClientMediator.sendCommand("BattleMap","ReloadBattleMapComponent", {contextId: battleMapId});
        }
    }
}