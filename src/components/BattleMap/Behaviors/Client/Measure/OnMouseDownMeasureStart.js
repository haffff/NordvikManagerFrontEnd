import { fabric } from "fabric";
import WebSocketManagerInstance from "../../../../game/WebSocketManager";
import DTOConverter from "../../../DTOConverter";
import UtilityHelper from "../../../../../helpers/UtilityHelper";

export class OnMouseDownMeasureStartClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (canvas.measureMode && canvas.measure) {
      //Get create element
      let arrow = canvas.measure.measureArrow;
      let measure = canvas.measure.measureObject;

      //get client rect of battlemap
      let { x, y } = canvas.getPointerWithAlign(opt);

      //Create object
      fabric.util.enlivenObjects([arrow, measure], function ([arrow, measure]) {
        arrow.set({ x1: x, y1: y, x2: x, y2: y });
        canvas.add(arrow);
        arrow.previewId = UtilityHelper.GenerateUUID();
        canvas.previewArrow = arrow;

        canvas.add(measure);
        canvas.set({ top: y + 10, left: x + 10 });
        canvas.previewMeasure = measure;
        measure.previewId = UtilityHelper.GenerateUUID();

        if (canvas.measure.visibleToOthers === true) {
          WebSocketManagerInstance.Send({
            command: "preview_start",
            battleMapId: battleMapId,
            data: [arrow, measure],
          });
        }
        canvas.requestRenderAll();
      });
    }
  }
}
