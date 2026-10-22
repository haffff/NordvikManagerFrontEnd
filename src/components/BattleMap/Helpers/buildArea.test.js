import { describe, it, expect } from "vitest";
import { fabric } from "fabric";
import { buildAreaObject, placeArea, applyAreaUpdate } from "./buildArea";
import { areaPolygon } from "./areaShape";

// One way to draw an area (aiming with RequestPoint, measuring): circle and rect centred on
// a point, line and cone as the polygon the area rule uses, text.
describe("buildArea", () => {
  const colors = { fill: "rgba(1,2,3,0.25)", stroke: "rgb(1,2,3)" };

  it("a circle centred on the point, in the given colours", () => {
    const o = buildAreaObject({ shape: "circle", radius: 100 }, { at: { x: 10, y: 20 }, ...colors });
    expect(o).toBeInstanceOf(fabric.Circle);
    expect([o.left, o.top, o.originX, o.radius, o.fill, o.stroke]).toEqual([10, 20, "center", 100, colors.fill, colors.stroke]);
    expect([o.selectable, o.evented]).toEqual([false, false]);
  });

  it("a rect centred on the point", () => {
    const o = buildAreaObject({ shape: "rect", width: 150, height: 50 }, { at: { x: 0, y: 0 }, ...colors });
    expect([o.type, o.width, o.height, o.originY]).toEqual(["rect", 150, 50, "center"]);
  });

  it("a cone is the polygon of the area rule", () => {
    const area = { shape: "cone", radius: 150, angle: 60 };
    const o = buildAreaObject(area, { at: { x: 100, y: 100 }, toward: { x: 200, y: 100 }, ...colors });
    expect(o).toBeInstanceOf(fabric.Polygon);
    expect(o.points).toEqual(areaPolygon({ ...area, x: 100, y: 100, toward: { x: 200, y: 100 } }));
  });

  it("a line or cone not aimed yet points right", () => {
    const o = buildAreaObject({ shape: "line", radius: 100, width: 50 }, { at: { x: 0, y: 0 }, ...colors });
    expect(o.points[1]).toEqual({ x: 100, y: 25 });
  });

  // Turning a cone moves its box: fabric must work out where the polygon now is.
  it("turns a cone, moving its box, and says what changed", () => {
    const area = { shape: "cone", radius: 150, angle: 60 };
    const o = buildAreaObject(area, { at: { x: 100, y: 100 }, toward: { x: 200, y: 100 }, ...colors });
    const update = placeArea(o, area, { x: 100, y: 100 }, { x: 0, y: 100 }); // now pointing left

    expect(update.points).toEqual(o.points);
    expect(o.getBoundingRect(true, true).left).toBeLessThan(0);
    expect(o.getCenterPoint().x).toBeLessThan(100);
  });

  it("moves and resizes a circle or rect", () => {
    const o = buildAreaObject({ shape: "rect", width: 10, height: 10 }, { at: { x: 0, y: 0 }, ...colors });
    expect(placeArea(o, { shape: "rect", width: 30, height: 20 }, { x: 5, y: 6 })).toEqual({ left: 5, top: 6, width: 30, height: 20 });
    expect([o.left, o.width]).toEqual([5, 30]);
  });

  // Someone else's aimed cone, turning on this screen (preview_update).
  it("applies another player's update to a polygon", () => {
    const area = { shape: "cone", radius: 150, angle: 60 };
    const mine = buildAreaObject(area, { at: { x: 100, y: 100 }, toward: { x: 200, y: 100 }, ...colors });
    const theirs = buildAreaObject(area, { at: { x: 100, y: 100 }, toward: { x: 200, y: 100 }, ...colors });
    const update = placeArea(mine, area, { x: 100, y: 100 }, { x: 100, y: 0 });

    applyAreaUpdate(theirs, update);

    expect(theirs.getCenterPoint().y).toBeCloseTo(mine.getCenterPoint().y);
    expect(theirs.left).toBeCloseTo(mine.left);
  });
});
