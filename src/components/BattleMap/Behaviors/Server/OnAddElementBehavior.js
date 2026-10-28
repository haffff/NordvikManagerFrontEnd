import { fabric } from "fabric";
import DTOConverter from "../../DTOConverter";
import ClientMediator from "../../../../ClientMediator";
import { ActiveWebHelper as WebHelper } from "../../../../helpers/transport";
import UtilityHelper from "../../../../helpers/UtilityHelper";
import { canControl } from "../../Helpers/permissionBits";

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
        canControl(response.data.permission) &&
        response.data.layer == selectedLayer;
      fabric.util.enlivenObjects([value], (e) => {
        e.forEach(async (element) => {
          const props = await WebHelper.getAsync(
            `properties/QueryProperties?parentIds=${response.data.id}`
          );

          const parsedProps = {};
          props.forEach((prop) => {
            parsedProps[prop.name] = prop;
          });

          element.properties = parsedProps;

          // Strict '>' (not '>=') so a new same-layer element is inserted after —
          // i.e. rendered on top of — any existing objects already on that layer,
          // matching the usual "newest on top" expectation.
          let found = canvas._objects.findIndex(
            (x) => x.layer > element.layer
          );
          if (found == -1) {
            canvas.add(element);
          } else {
            canvas.insertAt(element, found);
          }

          canvas.requestRenderAll();
          // Plain sendCommandAsync has no retry/queue — an element_add broadcast
          // can arrive (and this behavior fire) before TokenManager.Load() has
          // registered for this battle map yet, which would otherwise throw an
          // uncaught "Command not found" here instead of just loading late.
          // sendCommandWaitForRegisterAsync queues until it registers, matching
          // the established pattern elsewhere in this codebase (PropertiesPanel.js,
          // TokenQuickEditOverlay.js) for exactly this race.
          const isToken = await ClientMediator.sendCommandWaitForRegisterAsync(
            "battlemap_token",
            "IsToken",
            { contextId: battleMapId, id: response.data.id },
            true
          );
          if (isToken) {
            ClientMediator.sendCommand(
              "battlemap_token",
              "CanvasObjectLoadToken",
              { contextId: battleMapId, id: response.data.id }
            );
          }
          
          canvas.requestRenderAll();
        });
      });
    }
  }
}
