import ClientMediator from "../../../../../ClientMediator";
import UtilityHelper from "../../../../../helpers/UtilityHelper";

export class OnPropertyNotifyBehavior {
  async Handle(response, canvas, battleMapId) {

    let objects = canvas.getObjects();
    await Promise.all(
      objects.map(async (element) => {
        if (element.properties) {
          const properties = await ClientMediator.sendCommandAsync("Properties", "Get", { parentId: element.id });
          if (properties) {
            const finalProps = {};
            properties.forEach((prop) => {
              finalProps[prop.name] = prop;
            });
            element.properties = finalProps;
          }
        }
        return true;
      })
    );

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
