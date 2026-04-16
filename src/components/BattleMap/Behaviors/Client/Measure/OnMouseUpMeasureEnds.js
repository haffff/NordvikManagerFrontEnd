import { fabric } from "fabric";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../../helpers/transport";
import DTOConverter from "../../../DTOConverter";

export class OnMouseUpMeasureEndsClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (!canvas.measureMode || !canvas.measure || !canvas.previewArrow) return;

    if (opt.e.button !== 0) return;

    const element = canvas.previewArrow;
    const measure = canvas.previewMeasure;

    if (!canvas.measure.dissappearAfter) {
      // Normal mode: remove the preview shapes from the canvas entirely.
      if (canvas.measure.visibleToOthers) {
        WebSocketManagerInstance.Send({
          command: "preview_end",
          battleMapId: battleMapId,
          data: [
            { previewId: element.previewId, playerId: element.playerId },
            { previewId: measure.previewId, playerId: measure.playerId },
          ],
        });
      }

      canvas.remove(element);
      canvas.remove(measure);
    }
    // In both modes: clear the active-preview refs so mouse:move stops updating
    // the shape and the next mouse:down starts a fresh measurement.
    canvas.previewArrow = undefined;
    canvas.previewMeasure = undefined;
  }
}
