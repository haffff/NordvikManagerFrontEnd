import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../../helpers/transport";
import { measureArea, measureLabel } from "../../../Helpers/measure";
import { placeArea } from "../../../Helpers/buildArea";
import { glowTokensIn } from "../../../Helpers/areaGlow";

// A measurement follows the pointer: the arrow or area (Helpers/measure.js) and its text in
// the map's units; with "Highlight tokens" the tokens an area covers light up (the ones Find
// would give); with "Visible to others" everyone sees it move.
export class OnMouseMoveMeasureUpdateClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (!(canvas.measureMode && canvas.measure && canvas.previewArrow && canvas.previewMeasure)) return;

    const element = canvas.previewArrow;
    const measure = canvas.previewMeasure;
    const to = canvas.getPointerWithAlign(opt);
    const from = { x: canvas.measure.originX, y: canvas.measure.originY };
    const type = canvas.measure.measureType ?? "Line";

    let shape;
    const area = measureArea(type, from, to, canvas.measure.coneAngle);
    if (area) {
      shape = placeArea(element, area.area, area.at, area.toward);
      // Nothing is covered before the pointer moves (a cone has no direction yet).
      const moved = to.x !== from.x || to.y !== from.y;
      const covered = canvas.measure.highlightTokens && moved ? { ...area.area, x: area.at.x, y: area.at.y, toward: area.toward } : null;
      glowTokensIn(canvas, covered, canvas.measure.colors?.glow, "beforeMeasureShadow");
    } else {
      element.set({ x2: to.x, y2: to.y });
      shape = { x1: element.x1, x2: element.x2, y1: element.y1, y2: element.y2 };
    }

    measure.set({
      left: to.x + 10,
      top: to.y + 10,
      text: measureLabel(type, from, to, { gridSize: map.gridSize, ...canvas.measure }),
    });

    // A few pixels aren't a measurement yet.
    if (canvas.measure.visibleToOthers && Math.hypot(to.x - from.x, to.y - from.y) >= 10) {
      WebSocketManagerInstance.Send({
        command: "preview_update",
        battleMapId,
        data: [
          { previewId: element.previewId, ...shape },
          { previewId: measure.previewId, left: measure.left, top: measure.top, text: measure.text },
        ],
      });
    }

    canvas.requestRenderAll();
  }
}
