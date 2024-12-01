import ClientMediator from "../../../../../ClientMediator";

export class OnPropertyUpdateBehavior {
    async Handle(response, canvas, battleMapId) {
        let obj = canvas.getObjects().find(x => response.data.parentID && x.id === response.data.parentID);
        if (obj) {
            let index = obj.properties.findIndex(x => x.id === response.data.id);
            if (index !== -1) {
                obj.properties[response.data.name] = response.data;
            }
        }

        ClientMediator.sendCommandAsync("BattleMap_token", "UpdateTokensPropertySpecific", {
            contextId: battleMapId,
            property: response.data,
        });
    }
}