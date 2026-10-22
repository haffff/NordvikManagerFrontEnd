import { describe, it, expect, afterEach } from "vitest";
import { areaColors, parseRgb } from "./areaColors";

// The colours of an area being aimed or measured and of the tokens it lights up: the
// player's own colour, else the theme's (--nm-area-color), else orange.
describe("areaColors", () => {
  afterEach(() => document.documentElement.style.removeProperty("--nm-area-color"));

  it("reads #rgb, #rrggbb, rgb() and rgba()", () => {
    expect(parseRgb("#36f")).toEqual([51, 102, 255]);
    expect(parseRgb("#3366ff")).toEqual([51, 102, 255]);
    expect(parseRgb("rgb(1, 2, 3)")).toEqual([1, 2, 3]);
    expect(parseRgb("rgba(1,2,3,0.5)")).toEqual([1, 2, 3]);
    expect(parseRgb("teal-ish")).toBeNull();
    expect(parseRgb("rgb(300,0,0)")).toBeNull();
  });

  it("the player's colour: an outline, a see-through fill and a glow", () => {
    expect(areaColors("#3366ff")).toEqual({ stroke: "rgb(51,102,255)", fill: "rgba(51,102,255,0.25)", glow: "rgba(51,102,255,0.95)" });
  });

  it("the theme's when the player has none", () => {
    document.documentElement.style.setProperty("--nm-area-color", "#00ff00");
    expect(areaColors(undefined).stroke).toBe("rgb(0,255,0)");
    expect(areaColors("teal-ish").stroke).toBe("rgb(0,255,0)");
  });

  it("orange without either", () => {
    expect(areaColors(null).stroke).toBe("rgb(255,120,0)");
  });
});
