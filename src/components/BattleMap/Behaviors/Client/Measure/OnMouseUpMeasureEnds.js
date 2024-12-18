import { fabric } from "fabric";
import WebSocketManagerInstance from "../../../../game/WebSocketManager";
import DTOConverter from "../../../DTOConverter";

export class OnMouseUpMeasureEndsClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (canvas.measureMode && canvas.measureArrow && canvas.previewObject) {
        let element = canvas.previewObject;
        canvas.remove(element);
        canvas.previewObject = undefined;
    }
  }
}
