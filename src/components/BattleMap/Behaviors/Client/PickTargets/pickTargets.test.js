import { describe, it, expect } from "vitest";
import { startPicking, togglePick, canFinish, isCandidate, clickAt } from "./pickTargets";

// Picking tokens for an action (RequestTargets, or the editor's "Run from map"): a click
// toggles a token, never past Max and only among the candidates when there are some.
describe("pickTargets", () => {
  it("a click picks a token, a second click unpicks it", () => {
    let s = startPicking({ min: 1, max: 3 });
    s = togglePick(s, "a");
    s = togglePick(s, "b");
    expect(s.picked).toEqual(["a", "b"]);
    expect(togglePick(s, "a").picked).toEqual(["b"]);
  });

  it("never more than max", () => {
    let s = startPicking({ min: 1, max: 2 });
    for (const id of ["a", "b", "c"]) s = togglePick(s, id);
    expect(s.picked).toEqual(["a", "b"]);
  });

  it("only candidates, when there are some", () => {
    const s = startPicking({ min: 1, max: 3, candidates: ["a"] });
    expect(isCandidate(s, "a")).toBe(true);
    expect(isCandidate(s, "b")).toBe(false);
    expect(togglePick(s, "b").picked).toEqual([]);
  });

  it("can finish once min are picked", () => {
    let s = startPicking({ min: 2, max: 3 });
    expect(canFinish(s)).toBe(false);
    s = togglePick(togglePick(s, "a"), "b");
    expect(canFinish(s)).toBe(true);
    expect(canFinish(startPicking({ min: 0, max: 1 }))).toBe(true);
  });

  it("remembers where the map was last clicked", () => {
    expect(clickAt(startPicking({}), { x: 10, y: 20 }).position).toEqual({ x: 10, y: 20 });
  });
});
