import ClientMediator from "../../../../../ClientMediator";

export class OnPropertyUpdateBehavior {
    async Handle(response, canvas, battleMapId) {
        ClientMediator.sendCommandAsync("BattleMap_token", "UpdateTokensPropertySpecific", {
            contextId: battleMapId,
            property: response.data,
        });
    }
}