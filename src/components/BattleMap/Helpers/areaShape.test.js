import { describe, it, expect } from "vitest";
import { touchesToken, areaPolygon } from "./areaShape";
import shared from "./area-cases.json";

// What an area covers: the same cases as the server's (area-cases.json is shared with
// NordvikManager-Backend), so the glow on the map and Find agree.
describe("areaShape", () => {
  it.each(shared.cases.map((c) => [c.name, c]))("%s", (_, c) => {
    expect(touchesToken(c.area, c.token)).toBe(c.touches);
  });

  it("a line or cone without a direction has no shape", () => {
    expect(() => touchesToken({ shape: "cone", x: 0, y: 0, radius: 100 }, { x: 10, y: 0, w: 50, h: 50 })).toThrow();
  });

  // The polygon the map draws for a cone is the one the rule uses: apex, then the far corners.
  it("a cone's corners", () => {
    const [apex, left, right] = areaPolygon({ shape: "cone", x: 100, y: 100, radius: 150, angle: 90, toward: { x: 200, y: 100 } });
    expect(apex).toEqual({ x: 100, y: 100 });
    expect(left.x).toBeCloseTo(100 + 150 * Math.cos(Math.PI / 4));
    expect(left.y).toBeCloseTo(100 - 150 * Math.sin(Math.PI / 4));
    expect(right.y).toBeCloseTo(100 + 150 * Math.sin(Math.PI / 4));
  });
});
