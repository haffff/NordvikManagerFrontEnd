import { fabric } from "fabric";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../../helpers/transport";
import UtilityHelper from "../../../../../helpers/UtilityHelper";
import ClientMediator from "../../../../../ClientMediator";
import { measureArea } from "../../../Helpers/measure";
import { buildAreaObject } from "../../../Helpers/buildArea";

// Starts a measurement where the map was clicked: a ruler arrow (Line), or an area — Circle,
// Cone or Rect, drawn as markers are (Helpers/buildArea.js) — plus the text next to it.
export class OnMouseDownMeasureStartClientBehavior {
  Handle(opt, canvas, map, battleMapId) {
    if (!(canvas.measureMode && canvas.measure)) return;

    const { x, y } = canvas.getPointerWithAlign(opt);
    const player = ClientMediator.sendCommand("Game", "GetCurrentPlayer");
    const measureType = canvas.measure.measureType ?? "Line";
    const commonProps = {
      stayVisible: canvas.measure.dissappearAfter ? true : false,
      playerId: player.id,
    };
    canvas.measure.originX = x;
    canvas.measure.originY = y;

    const start = (arrow, measure) => {
      arrow.set({ ...commonProps, previewId: UtilityHelper.GenerateUUID() });
      canvas.previewArrow = arrow;
      canvas.add(arrow);

      measure.set({ ...commonProps, previewId: UtilityHelper.GenerateUUID(), top: y + 10, left: x + 10 });
      canvas.previewMeasure = measure;
      canvas.add(measure);

      if (canvas.measure.visibleToOthers === true) {
        WebSocketManagerInstance.Send({ command: "preview_start", battleMapId, data: [arrow, measure] });
      }
      canvas.requestRenderAll();
    };

    const area = measureArea(measureType, { x, y }, { x, y }, canvas.measure.coneAngle);
    if (area) {
      fabric.util.enlivenObjects([canvas.measure.measureObject], ([measure]) =>
        start(buildAreaObject(area.area, { at: area.at, toward: area.toward, ...canvas.measure.colors }), measure));
      return;
    }

    fabric.util.enlivenObjects([canvas.measure.measureArrow, canvas.measure.measureObject], ([arrow, measure]) => {
      arrow.set({ x1: x, y1: y, x2: x, y2: y });
      start(arrow, measure);
    });
  }
}
