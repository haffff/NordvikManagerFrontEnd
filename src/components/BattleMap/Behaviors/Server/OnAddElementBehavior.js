import { fabric } from "fabric";
import DTOConverter from "../../DTOConverter";
import ClientMediator from "../../../../ClientMediator";
import WebHelper from "../../../../helpers/WebHelper";
import UtilityHelper from "../../../../helpers/UtilityHelper";

export class OnAddElementBehavior {
  Handle(response, canvas, battleMapId) {
    let mapId = ClientMediator.sendCommand("BattleMap", "GetSelectedMapID", {
      contextId: battleMapId,
    });
    let selectedLayer = ClientMediator.sendCommand(
      "BattleMap",
      "GetSelectedLayer",
      { contextId: battleMapId }
    );
    if (mapId === response.data.mapId) {
      let value = DTOConverter.ConvertFromDTO(response.data);
      value.selectable =
        (response.data.permission & 4) == 4 &&
        response.data.layer == selectedLayer;
      fabric.util.enlivenObjects([value], (e) => {
        e.forEach(async (element) => {
          const props = await WebHelper.getAsync(
            `properties/QueryProperties?parentIds=${response.result}`
          );

          const parsedProps = {};
          props.forEach((prop) => {
            parsedProps[prop.name] = prop;
          });

          element.properties = parsedProps;

          let found = canvas._objects.findIndex(
            (x) => x.layer >= element.layer
          );
          if (found == -1) {
            canvas.add(element);
          } else {
            canvas.insertAt(element, found);
          }

          canvas.requestRenderAll();

          if (UtilityHelper.ParseBool(element?.properties["isToken"]?.value)) {
            ClientMediator.sendCommand(
              "battlemap_token",
              "CanvasObjectLoadToken",
              { contextId: battleMapId, id: element.id }
            );
          }
          
          canvas.requestRenderAll();
        });
      });
    }
  }
}
