import { fabric } from "fabric";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../../helpers/transport";
import DTOConverter from "../../../DTOConverter";
import { addSketch } from "./sketches";

export class OnPathCreatedFreeDrawClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (canvas.freeDrawMode) {
      // Sketch mode: the stroke stays a preview, it doesn't become a map element.
      if (canvas.freeDrawSketch) {
        addSketch(canvas, opt.path, battleMapId);
        return;
      }

      let dto = DTOConverter.ConvertToDTO(opt.path);
      dto.mapId = map.id;
      dto.layer = canvas.selectedLayer;
      WebSocketManagerInstance.Send({
        command: "element_add",
        data: dto,
      });
      canvas.remove(opt.path);
    }
  }
}
