import { describe, it, expect } from "vitest";
import { measureArea, measureLabel } from "./measure";

// Measuring on the map: the area a Circle, Cone or Rect covers (the same shapes as markers
// and Find), and the text shown next to it in the map's units.
describe("measure", () => {
  const grid5ft = { gridSize: 50, units: "ft", distancePerSquare: 5, realisticMeasure: false };

  it.each([
    ["a circle from where the drag started, as wide as the drag", "Circle", { x: 0, y: 0 }, { x: 30, y: 40 }, undefined,
      { area: { shape: "circle", radius: 50 }, at: { x: 0, y: 0 } }],
    ["a cone from where the drag started, toward the pointer, as long as the drag", "Cone", { x: 0, y: 0 }, { x: 30, y: 40 }, 60,
      { area: { shape: "cone", radius: 50, angle: 60 }, at: { x: 0, y: 0 }, toward: { x: 30, y: 40 } }],
    ["a rect from corner to corner, centred between them", "Rect", { x: 100, y: 0 }, { x: 0, y: 50 }, undefined,
      { area: { shape: "rect", width: 100, height: 50 }, at: { x: 50, y: 25 } }],
    ["a line has no area", "Line", { x: 0, y: 0 }, { x: 30, y: 40 }, undefined, null],
  ])("%s", (_name, shape, from, to, coneAngle, expected) => {
    expect(measureArea(shape, from, to, coneAngle)).toEqual(expected);
  });

  // As the ruler always measured: a line's (and a cone's) length is the squares on the longer
  // side, or the straight distance with "realistic measure"; a circle's radius is straight.
  it.each([
    ["a line's length: squares on the longer side", "Line", { x: 150, y: 100 }, grid5ft, "15ft"],
    ["a line's length: straight with realistic measure", "Line", { x: 150, y: 200 }, { ...grid5ft, realisticMeasure: true }, "25ft"],
    ["a cone's length the same way", "Cone", { x: 150, y: 100 }, grid5ft, "15ft"],
    ["a circle's radius, straight", "Circle", { x: 120, y: 160 }, grid5ft, "20ft r"],
    ["a rect's sides", "Rect", { x: -150, y: 100 }, grid5ft, "15 × 10 ft"],
    ["in the map's own units", "Line", { x: 100, y: 0 }, { gridSize: 50, units: "m", distancePerSquare: 1.5 }, "3m"],
  ])("%s", (_name, shape, to, map, expected) => {
    expect(measureLabel(shape, { x: 0, y: 0 }, to, map)).toBe(expected);
  });

});
