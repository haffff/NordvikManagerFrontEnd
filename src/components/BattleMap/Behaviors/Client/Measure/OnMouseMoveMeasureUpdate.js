import { fabric } from "fabric";
import WebSocketManagerInstance from "../../../../game/WebSocketManager";
import DTOConverter from "../../../DTOConverter";

export class OnMouseMoveMeasureUpdateClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (canvas.measureMode && canvas.measureArrow && canvas.previewObject) {
      //Get preview element
      let element = canvas.previewObject;

      //get client rect of battlemap
      let canvasCoords = canvas.getPointer(opt);

      element.set({ x2: canvasCoords.x, y2: canvasCoords.y });

      canvas.requestRenderAll();
    }
  }
}
