import { fabric } from "fabric";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../../helpers/transport";
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

  MeasureRadius(radius, map, canvas) {
    const gridSize = map.gridSize;
    const units = canvas.measure.units ?? "ft";
    const distancePerSquare = canvas.measure.distancePerSquare ?? 5;
    const r = ((radius / gridSize) * distancePerSquare).toFixed(0);
    return r + units + " r";
  }

  Handle(opt, canvas, map, battleMapId) {
    if (
      canvas.measureMode &&
      canvas.measure &&
      canvas.previewArrow &&
      canvas.previewMeasure
    ) {
      const element = canvas.previewArrow;
      const canvasCoords = canvas.getPointerWithAlign(opt);
      const measure = canvas.previewMeasure;
      const measureType = canvas.measure.measureType ?? 'Line';

      if (measureType === 'Circle') {
        const ox = canvas.measure.originX;
        const oy = canvas.measure.originY;
        const dx = canvasCoords.x - ox;
        const dy = canvasCoords.y - oy;
        const radius = Math.sqrt(dx * dx + dy * dy);

        element.set({ radius });

        measure.set({
          left: canvasCoords.x + 10,
          top: canvasCoords.y + 10,
          text: this.MeasureRadius(radius, map, canvas),
        });

        if (canvas.measure.visibleToOthers && radius > 10) {
          WebSocketManagerInstance.Send({
            command: "preview_update",
            battleMapId: battleMapId,
            data: [
              { previewId: element.previewId, left: element.left, top: element.top, radius },
              { previewId: measure.previewId, left: measure.left, top: measure.top, text: measure.text },
            ],
          });
        }
      } else if (measureType === 'Cone') {
        const coneAngle = canvas.measure.coneAngle ?? 53;
        element.set({ x2: canvasCoords.x, y2: canvasCoords.y, coneAngle });

        measure.set({
          left: canvasCoords.x + 10,
          top: canvasCoords.y + 10,
          text: this.MeasureDistance(element, map, canvas),
        });

        if (canvas.measure.visibleToOthers) {
          const distance = Math.sqrt(
            Math.pow(element.x1 - element.x2, 2) + Math.pow(element.y1 - element.y2, 2)
          );
          if (distance < 10) return;

          WebSocketManagerInstance.Send({
            command: "preview_update",
            battleMapId: battleMapId,
            data: [
              { previewId: element.previewId, x1: element.x1, x2: element.x2, y1: element.y1, y2: element.y2, coneAngle },
              { previewId: measure.previewId, left: measure.left, top: measure.top, text: measure.text },
            ],
          });
        }
      } else {
        // Line (default)
        element.set({ x2: canvasCoords.x, y2: canvasCoords.y });

        measure.set({
          left: canvasCoords.x + 10,
          top: canvasCoords.y + 10,
          text: this.MeasureDistance(element, map, canvas),
        });

        if (canvas.measure.visibleToOthers) {
          const distance = Math.sqrt(
            Math.pow(element.x1 - element.x2, 2) + Math.pow(element.y1 - element.y2, 2)
          );
          if (distance < 10) return;

          WebSocketManagerInstance.Send({
            command: "preview_update",
            battleMapId: battleMapId,
            data: [
              { previewId: element.previewId, x1: element.x1, x2: element.x2, y1: element.y1, y2: element.y2 },
              { previewId: measure.previewId, left: measure.left, top: measure.top, text: measure.text },
            ],
          });
        }
      }

      canvas.requestRenderAll();
    }
  }
}
