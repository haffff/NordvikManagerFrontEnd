import { fabric } from "fabric";
import WebSocketManagerInstance from "../../../../game/WebSocketManager";
import DTOConverter from "../../../DTOConverter";

export class OnMouseDownMeasureStartClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (canvas.measureMode && canvas.measureArrow) {
      //Get create element
      let element = canvas.measureArrow;

      //get client rect of battlemap
      let { x, y } = canvas.getPointer(opt);

      //Create object
      fabric.util.enlivenObjects([element], function ([arrow]) {
        arrow.set({ x1: x, y1: y, x2: x, y2: y });
        canvas.add(arrow);
        canvas.previewObject = arrow;
        canvas.requestRenderAll();
      });
    }
  }
}
