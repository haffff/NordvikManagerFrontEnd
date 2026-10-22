import { describe, it, expect } from "vitest";
import { measureArea, measureLabel } from "./measure";

// Measuring on the map: the area a Circle, Cone or Rect covers (the same shapes as markers
// and Find), and the text shown next to it in the map's units.
describe("measure", () => {
  const grid5ft = { gridSize: 50, units: "ft", distancePerSquare: 5, realisticMeasure: false };

  it("a circle from where the drag started, as wide as the drag", () => {
    expect(measureArea("Circle", { x: 0, y: 0 }, { x: 30, y: 40 })).toEqual({ area: { shape: "circle", radius: 50 }, at: { x: 0, y: 0 } });
  });

  it("a cone from where the drag started, toward the pointer, as long as the drag", () => {
    expect(measureArea("Cone", { x: 0, y: 0 }, { x: 30, y: 40 }, 60)).toEqual({
      area: { shape: "cone", radius: 50, angle: 60 }, at: { x: 0, y: 0 }, toward: { x: 30, y: 40 },
    });
  });

  it("a rect from corner to corner, centred between them", () => {
    expect(measureArea("Rect", { x: 100, y: 0 }, { x: 0, y: 50 })).toEqual({ area: { shape: "rect", width: 100, height: 50 }, at: { x: 50, y: 25 } });
  });

  it("a line has no area", () => {
    expect(measureArea("Line", { x: 0, y: 0 }, { x: 30, y: 40 })).toBeNull();
  });

  // As the ruler always measured: squares counted on the longer side, or the straight
  // distance with "realistic measure".
  it("a line's length: squares on the longer side, or straight with realistic measure", () => {
    expect(measureLabel("Line", { x: 0, y: 0 }, { x: 150, y: 100 }, grid5ft)).toBe("15ft");
    expect(measureLabel("Line", { x: 0, y: 0 }, { x: 150, y: 200 }, { ...grid5ft, realisticMeasure: true })).toBe("25ft");
  });

  it("a cone's length the same way", () => {
    expect(measureLabel("Cone", { x: 0, y: 0 }, { x: 150, y: 100 }, grid5ft)).toBe("15ft");
  });

  it("a circle's radius, straight", () => {
    expect(measureLabel("Circle", { x: 0, y: 0 }, { x: 120, y: 160 }, grid5ft)).toBe("20ft r");
  });

  it("a rect's sides", () => {
    expect(measureLabel("Rect", { x: 0, y: 0 }, { x: -150, y: 100 }, grid5ft)).toBe("15 × 10 ft");
  });

  it("in the map's own units", () => {
    expect(measureLabel("Line", { x: 0, y: 0 }, { x: 100, y: 0 }, { gridSize: 50, units: "m", distancePerSquare: 1.5 })).toBe("3m");
  });
});
