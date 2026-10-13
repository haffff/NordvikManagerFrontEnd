import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../../helpers/transport";
import DTOConverter from "../../../DTOConverter";
import { MIN_BOX, MIN_RADIUS, sizingKind } from "./sizing";

export class OnMouseUpSimpleCreateClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (
      canvas.simpleCreateMode &&
      canvas.simpleCreateElement &&
      canvas.previewObject
    ) {
      let element = canvas.previewObject;
      const kind = sizingKind(canvas.withSizing);

      let keep = true;
      if (kind === "box") {
        keep = element.width > MIN_BOX && element.height > MIN_BOX;
      } else if (kind === "radius") {
        keep = element.radius > MIN_RADIUS;
        // Saved like every other circle: top-left origin, around the dragged center.
        if (keep) {
          element.set({
            originX: "left",
            originY: "top",
            left: element.left - element.radius,
            top: element.top - element.radius,
          });
        }
      }

      if (keep) {
        let dto = DTOConverter.ConvertToDTO(element);
        WebSocketManagerInstance.Send({
          command: "element_add",
          data: dto,
        });
      } else {
        console.debug('[SimpleCreate] shape too small, discarded');
      }

      canvas.remove(element);
      canvas.previewObject = null;
      canvas.previewSpawning = false;
      canvas.previewAnchorX = null;
      canvas.previewAnchorY = null;

      canvas.requestRenderAll();
    }
  }
}
