import ClientMediator from "../../../../../ClientMediator";
import UtilityHelper from "../../../../../helpers/UtilityHelper";

export class OnPropertyNotifyBehavior {
  async Handle(response, canvas, battleMapId) {
    let tokens = canvas
      .getObjects()
      .filter((x) => UtilityHelper.ParseBool(x.properties?.isToken?.value));
    tokens.forEach((token) => {
      ClientMediator.sendCommandAsync(
        "BattleMap_token",
        "UpdateTokenBasedOnProperties",
        {
          contextId: battleMapId,
          tokenId: token.id,
        }
      );
    });
  }
}
