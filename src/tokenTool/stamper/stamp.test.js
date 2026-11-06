import { describe, it, expect } from "vitest";
import { stampLayout, stamp, panBy } from "./stamp";

// The token stamper turns a picture (a portrait) into a square token image: the part
// picked by zoom and pan, optionally cut to a circle and ringed.
describe("stampLayout", () => {
  it("takes the largest centred square at zoom 1", () => {
    expect(stampLayout({ imgW: 400, imgH: 200 })).toEqual({ sx: 100, sy: 0, side: 200 });
    expect(stampLayout({ imgW: 300, imgH: 600 })).toEqual({ sx: 0, sy: 150, side: 300 });
  });

  it("zooming in takes a smaller square around the same centre", () => {
    expect(stampLayout({ imgW: 400, imgH: 400, zoom: 2 })).toEqual({ sx: 100, sy: 100, side: 200 });
  });

  it("can't zoom out past the picture", () => {
    expect(stampLayout({ imgW: 400, imgH: 400, zoom: 0.5 })).toEqual({ sx: 0, sy: 0, side: 400 });
  });

  it("pans in picture pixels, never past an edge", () => {
    expect(stampLayout({ imgW: 400, imgH: 400, zoom: 2, panX: 50, panY: -30 })).toEqual({ sx: 150, sy: 70, side: 200 });
    expect(stampLayout({ imgW: 400, imgH: 400, zoom: 2, panX: 1000, panY: -1000 })).toEqual({ sx: 200, sy: 0, side: 200 });
    expect(stampLayout({ imgW: 400, imgH: 200, panY: 50 })).toEqual({ sx: 100, sy: 0, side: 200 });
  });
});

const recorder = () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, key) => (...args) => calls.push([key, ...args]),
    set: (_, key, value) => { calls.push([`set ${String(key)}`, value]); return true; },
  });
  return { ctx, calls, names: () => calls.map((c) => c[0]) };
};
const image = { width: 400, height: 200 };
const layout = { sx: 100, sy: 0, side: 200 };

describe("stamp", () => {
  it("draws the picked square over the whole output", () => {
    const { ctx, calls, names } = recorder();
    stamp(ctx, image, { size: 256, layout });
    expect(calls).toContainEqual(["drawImage", image, 100, 0, 200, 200, 0, 0, 256, 256]);
    expect(names()).not.toContain("clip");
    expect(names()).not.toContain("stroke");
  });

  it("a circle clips the picture before drawing it, leaving the corners transparent", () => {
    const { ctx, calls, names } = recorder();
    stamp(ctx, image, { size: 256, layout, circle: true });
    expect(calls).toContainEqual(["arc", 128, 128, 128, 0, Math.PI * 2]);
    expect(names().indexOf("clip")).toBeLessThan(names().indexOf("drawImage"));
    expect(names()[0]).toBe("clearRect");
  });

  it("a ring is drawn inside the edge, after the picture", () => {
    const { ctx, calls, names } = recorder();
    stamp(ctx, image, { size: 256, layout, circle: true, ring: { width: 8, color: "#c9a227" } });
    expect(calls).toContainEqual(["arc", 128, 128, 124, 0, Math.PI * 2]);
    expect(calls).toContainEqual(["set strokeStyle", "#c9a227"]);
    expect(calls).toContainEqual(["set lineWidth", 8]);
    expect(names().lastIndexOf("stroke")).toBeGreaterThan(names().indexOf("drawImage"));
  });

  it("without a circle the ring is a square frame", () => {
    const { ctx, calls } = recorder();
    stamp(ctx, image, { size: 256, layout, ring: { width: 8, color: "red" } });
    expect(calls).toContainEqual(["strokeRect", 4, 4, 248, 248]);
  });

  it("a ring of width 0 draws nothing", () => {
    const { ctx, names } = recorder();
    stamp(ctx, image, { size: 256, layout, circle: true, ring: { width: 0, color: "red" } });
    expect(names()).not.toContain("stroke");
  });
});

describe("panBy", () => {
  // Dragging the picture on screen moves the square the other way, in picture pixels:
  // the shown square is `shown` screen pixels wide and covers `side` picture pixels.
  it("drags in picture pixels: dragging right shows more of the left", () => {
    const view = { imgW: 400, imgH: 400, zoom: 2, panX: 0, panY: 0 };
    expect(panBy(view, { dx: 64, dy: -32, shown: 256 })).toEqual({ ...view, panX: -50, panY: 25 });
  });

  it("stops at the picture's edge, so dragging back works at once", () => {
    const view = { imgW: 400, imgH: 400, zoom: 2, panX: 0, panY: 0 };
    expect(panBy(view, { dx: 10000, dy: 0, shown: 256 })).toEqual({ ...view, panX: -100, panY: 0 });
  });

  it("a whole picture (zoom 1 on a square) doesn't move", () => {
    const view = { imgW: 300, imgH: 300, zoom: 1, panX: 0, panY: 0 };
    expect(panBy(view, { dx: 50, dy: 50, shown: 256 })).toEqual(view);
  });
});
