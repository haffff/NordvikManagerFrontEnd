import ClientMediator from "../../../../../ClientMediator";

export class OnPropertyDeleteBehavior {
  Handle(response, canvas, battleMapId) {
    // Was a no-op — unlike OnPropertyAddBehavior/OnPropertyUpdateBehavior, a deleted
    // property never told dependent token UI (e.g. a status icon prop-dep) to
    // re-evaluate, so it kept showing the last value it had before deletion.
    ClientMediator.sendCommandAsync("BattleMap_token", "UpdateTokensPropertySpecific", {
      contextId: battleMapId,
      property: response.data,
    });
  }
}
