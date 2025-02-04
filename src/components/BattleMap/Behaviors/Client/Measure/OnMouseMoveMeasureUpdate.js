import { fabric } from "fabric";
import WebSocketManagerInstance from "../../../../game/WebSocketManager";
import DTOConverter from "../../../DTOConverter";

export class OnMouseMoveMeasureUpdateClientBehavior {
  MeasureDistance(element, map, canvas) {
    let x1 = element.x1;
    let y1 = element.y1;
    let x2 = element.x2;
    let y2 = element.y2;

    let a = x1 - x2;
    let b = y1 - y2;

    //get gridSize
    let gridSize = map.gridSize;

    let units = canvas.measure.units ?? "ft";
    let realisticMeasure = canvas.measure.realisticMeasure ?? false;
    let distancePerSquare = canvas.measure.distancePerSquare ?? 5;

    let c = 0;
    if (realisticMeasure) {
      c = (Math.sqrt(a * a + b * b) / gridSize) * distancePerSquare;
    } else {
      c = (Math.max(Math.abs(a), Math.abs(b)) / gridSize) * distancePerSquare;
    }

    return c.toFixed(0) + units;
  }

  Handle(opt, canvas, map, battleMapId) {
    if (
      canvas.measureMode &&
      canvas.measure &&
      canvas.previewArrow &&
      canvas.previewMeasure
    ) {
      //Get preview element
      let element = canvas.previewArrow;

      //get client rect of battlemap
      let canvasCoords = canvas.getPointerWithAlign(opt);

      element.set({ x2: canvasCoords.x, y2: canvasCoords.y });

      //Get measure preview
      let measure = canvas.previewMeasure;
      measure.set({
        left: canvasCoords.x + 10,
        top: canvasCoords.y + 10,
        text: this.MeasureDistance(element, map, canvas),
      });

      if (canvas.measure.visibleToOthers) {
        
        //Calculate if its worth to send preview update
        let distance = Math.sqrt( Math.pow(element.x1 - element.x2, 2) + Math.pow(element.y1 - element.y2, 2) );
        if (distance < 10) {
          return;
        }

        WebSocketManagerInstance.Send({
          command: "preview_update",
          battleMapId: battleMapId,
          data: [
            {
              previewId: element.previewId,
              x1: element.x1,
              x2: element.x2,
              y1: element.y1,
              y2: element.y2,
            },
            {
              previewId: measure.previewId,
              left: measure.left,
              top: measure.top,
              text: measure.text,
            },
          ],
        });
      }

      canvas.requestRenderAll();
    }
  }
}
