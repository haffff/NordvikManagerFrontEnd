import { fabric } from "fabric";
import WebSocketManagerInstance from "../../../../game/WebSocketManager";
import DTOConverter from "../../../DTOConverter";

export class OnMouseUpMeasureEndsClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (canvas.measureMode && canvas.measure && canvas.previewArrow && !canvas.measure.dissappearAfter) {
      //if its not left mouse button return

      if (opt.e.button !== 0) {
        return;
      }

      let element = canvas.previewArrow;

      if (canvas.measure.visibleToOthers) {
        WebSocketManagerInstance.Send({
          command: "preview_end",
          battleMapId: battleMapId,
          data: [
            { previewId: element.previewId, playerId: element.playerId },
            { previewId: canvas.previewMeasure.previewId, playerId: canvas.previewMeasure.playerId },
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
