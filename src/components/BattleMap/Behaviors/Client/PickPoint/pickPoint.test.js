import { describe, it, expect, vi } from "vitest";
import { startPointing, snapPoint, inRange, pointerAt, areaAt, throttled } from "./pickPoint";

// Pointing at the map for an action (RequestPoint): the area follows the cursor, snapped to
// the grid when asked, and only a point within range can be chosen. A line or cone starts at
// `from` and the cursor only aims it.
describe("pickPoint", () => {
  it("snaps to the middle of a square, or to where grid lines cross", () => {
    expect(snapPoint({ x: 61, y: 140 }, 50, "center")).toEqual({ x: 75, y: 125 });
    expect(snapPoint({ x: 61, y: 140 }, 50, "corner")).toEqual({ x: 50, y: 150 });
    expect(snapPoint({ x: 61.4, y: 140.6 }, 50, "none")).toEqual({ x: 61, y: 141 });
  });

  it("is in range within the radius, or always without one", () => {
    const range = { x: 0, y: 0, radius: 100 };
    expect(inRange({ x: 60, y: 80 }, range)).toBe(true);
    expect(inRange({ x: 61, y: 80 }, range)).toBe(false);
    expect(inRange({ x: 1e6, y: 0 }, null)).toBe(true);
  });

  it("follows the pointer: snapped, and whether it may be chosen there", () => {
    const s = startPointing({ snap: "center", range: { x: 0, y: 0, radius: 100 } }, 50);
    expect(pointerAt(s, { x: 10, y: 10 })).toMatchObject({ position: { x: 25, y: 25 }, allowed: true });
    expect(pointerAt(s, { x: 200, y: 10 })).toMatchObject({ position: { x: 225, y: 25 }, allowed: false });
  });

  // The server sized the area and the range with its grid size: snapping uses the same.
  it("snaps with the grid size the server sent", () => {
    const s = startPointing({ gridSize: 70, snap: "corner" }, 50);
    expect(pointerAt(s, { x: 40, y: 120 }).position).toEqual({ x: 70, y: 140 });
  });

  it("has nothing to choose before the pointer moves", () => {
    expect(startPointing({}, 50)).toMatchObject({ position: null, allowed: false, snap: "none" });
  });

  // The area the glow and Find use: centred on the pointer, or from `from` toward it.
  it("a circle's area is at the pointer", () => {
    const s = pointerAt(startPointing({ area: { shape: "circle", radius: 100 } }, 50), { x: 10, y: 20 });
    expect(areaAt(s)).toEqual({ shape: "circle", radius: 100, x: 10, y: 20 });
  });

  it("a cone's area starts at from and points at the pointer", () => {
    const s = pointerAt(startPointing({ area: { shape: "cone", radius: 150, angle: 53 }, from: { x: 0, y: 0 } }, 50), { x: 30, y: 40 });
    expect(areaAt(s)).toEqual({ shape: "cone", radius: 150, angle: 53, x: 0, y: 0, toward: { x: 30, y: 40 } });
    expect(s.allowed).toBe(true);
  });

  it("a cone can't be aimed at its own start", () => {
    const s = pointerAt(startPointing({ area: { shape: "cone", radius: 150 }, from: { x: 0, y: 0 } }, 50), { x: 0, y: 0 });
    expect(s.allowed).toBe(false);
    expect(areaAt(s)).toBeNull();
  });

  it("text, no area or no pointer yet covers nothing", () => {
    expect(areaAt(pointerAt(startPointing({ area: { shape: "text", text: "x" } }, 50), { x: 0, y: 0 }))).toBeNull();
    expect(areaAt(pointerAt(startPointing({}, 50), { x: 0, y: 0 }))).toBeNull();
    expect(areaAt(startPointing({ area: { shape: "circle", radius: 1 } }, 50))).toBeNull();
  });

  // The area's moves go to the other players at most every `ms`, the last one always.
  it("sends at most once per interval, and the last call after it", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const t = throttled(send, 50);
    t(1); t(2); t(3);
    expect(send.mock.calls).toEqual([[1]]);
    vi.advanceTimersByTime(50);
    expect(send.mock.calls).toEqual([[1], [3]]);
    t.cancel();
    vi.useRealTimers();
  });

  it("sends nothing more once cancelled", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const t = throttled(send, 50);
    t(1); t(2);
    t.cancel();
    vi.advanceTimersByTime(100);
    expect(send.mock.calls).toEqual([[1]]);
    vi.useRealTimers();
  });
});
