import { fabric } from "fabric";
import { areaPolygon } from "./areaShape";

// Drawing an area on the map — for aiming with RequestPoint and for measuring: a circle or
// rect centred on `at`, a line or cone from `at` toward `toward` (the polygon of the area
// rule, areaShape.js — the server draws markers the same way), or text. Sizes in map pixels:
// { shape, radius, width, height, angle, text, fontSize }.

const RIGHT = { x: 1, y: 0 };

const polygonOf = (area, at, toward) =>
  areaPolygon({ ...area, x: at.x, y: at.y, toward: toward && (toward.x !== at.x || toward.y !== at.y) ? toward : { x: at.x + RIGHT.x, y: at.y + RIGHT.y } });

export function buildAreaObject(area, { at, toward, fill, stroke }) {
  const common = { fill, stroke, strokeWidth: 2, selectable: false, evented: false, objectCaching: false };
  switch (area.shape) {
    case "line":
    case "cone":
      return new fabric.Polygon(polygonOf(area, at, toward), common);
    case "rect":
      return new fabric.Rect({ ...common, left: at.x, top: at.y, width: area.width, height: area.height, originX: "center", originY: "center" });
    case "text":
      return new fabric.Text(area.text ?? "", {
        ...common, left: at.x, top: at.y, fontSize: area.fontSize ?? 30, fill: stroke, stroke: "black", strokeWidth: 1,
        originX: "center", originY: "center",
      });
    default:
      return new fabric.Circle({ ...common, left: at.x, top: at.y, radius: area.radius, originX: "center", originY: "center" });
  }
}

// Moves (and turns, and resizes) an area drawn by buildAreaObject; returns what changed, for
// the other players' copies (preview_update → applyAreaUpdate).
export function placeArea(object, area, at, toward) {
  let update;
  if (area.shape === "line" || area.shape === "cone") update = { points: polygonOf(area, at, toward) };
  else if (area.shape === "rect") update = { left: at.x, top: at.y, width: area.width, height: area.height };
  else if (area.shape === "circle") update = { left: at.x, top: at.y, radius: area.radius };
  else update = { left: at.x, top: at.y };
  applyAreaUpdate(object, update);
  return update;
}

// Applies a placeArea update; new points make fabric work out the polygon's box again.
export function applyAreaUpdate(object, update) {
  object.set(update);
  if (update.points && typeof object._setPositionDimensions === "function") object._setPositionDimensions({});
  object.setCoords?.();
}
