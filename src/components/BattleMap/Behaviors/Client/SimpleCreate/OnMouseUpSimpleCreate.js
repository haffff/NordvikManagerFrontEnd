import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../../helpers/transport";
import DTOConverter from "../../../DTOConverter";

export class OnMouseUpSimpleCreateClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (
      canvas.simpleCreateMode &&
      canvas.simpleCreateElement &&
      canvas.previewObject
    ) {
      let element = canvas.previewObject;

      if (!canvas.withSizing || (element.width > 10 && element.height > 10)) {
        let dto = DTOConverter.ConvertToDTO(element);
        WebSocketManagerInstance.Send({
          command: "element_add",
          data: dto,
        });
      } else if (canvas.withSizing) {
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
