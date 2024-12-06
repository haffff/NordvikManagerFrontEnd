import ClientMediator from "../../../../../ClientMediator";

export class OnPropertyAddBehavior {
    Handle(response, canvas,battleMapId) {
        ClientMediator.sendCommandAsync("BattleMap_token", "UpdateTokensPropertySpecific", {
            contextId: battleMapId,
            property: response.data,
        });
    }
}