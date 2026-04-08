import { fabric } from "fabric";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../../helpers/transport";
import DTOConverter from "../../../DTOConverter";

export class OnPathCreatedFreeDrawClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (canvas.freeDrawMode) {
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
