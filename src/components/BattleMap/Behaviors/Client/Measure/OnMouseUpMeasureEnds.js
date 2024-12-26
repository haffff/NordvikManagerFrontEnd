import { fabric } from "fabric";
import WebSocketManagerInstance from "../../../../game/WebSocketManager";
import DTOConverter from "../../../DTOConverter";

export class OnMouseUpMeasureEndsClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (canvas.measureMode && canvas.measure && canvas.previewArrow) {
      let element = canvas.previewArrow;

      if (canvas.measure.visibleToOthers) {
        WebSocketManagerInstance.Send({
          command: "preview_end",
          battleMapId: battleMapId,
          data: [
            { previewId: element.previewId },
            { previewId: canvas.previewMeasure.previewId },
          ],
        });
      }

      canvas.remove(element);
      canvas.previewArrow = undefined;

      //Get measure preview
      let measure = canvas.previewMeasure;
      canvas.remove(measure);
      canvas.previewMeasure = undefined;
    }
  }
}
