import ClientMediator from "../../../../../ClientMediator";
import UtilityHelper from "../../../../../helpers/UtilityHelper";

export class OnPropertyNotifyBehavior {
  async Handle(response, canvas, battleMapId) {
    //TODO: Implement
    // let obj = canvas.getObjects().find(x => response.data.parentID && x.id === response.data.parentID);
    // if (obj) {
    //     let index = obj.properties.findIndex(x => x.id === response.data.id);
    //     if (index !== -1) {
    //         obj.properties[response.data.name] = response.data;
    //     }
    // }
    //Get all tokens
    let tokens = canvas
      .getObjects()
      .filter((x) => UtilityHelper.ParseBool(x.properties?.isToken?.value));
    tokens.forEach((token) => {
      ClientMediator.sendCommandAsync(
        "BattleMap_token",
        "UpdateTokenBasedOnProperties",
        {
          contextId: battleMapId,
          tokenId: token.id
        }
      );
    });
  }
}
