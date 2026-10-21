import { describe, it, expect } from "vitest";
import { runFromMapArgs } from "./runFromMap";

// "Run from map": the action gets what a map tool or menu click would give it.
describe("runFromMapArgs", () => {
  it("gives the click, the picked tokens and the map", () => {
    expect(runFromMapArgs({ picked: ["a", "b"], position: { x: 1, y: 2 } }, { battleMapId: "bm", mapId: "m" }))
      .toEqual({ battleMapId: "bm", mapId: "m", position: { x: 1, y: 2 }, elementId: "a", elementIds: ["a", "b"] });
  });

  it("leaves out what wasn't picked or clicked", () => {
    expect(runFromMapArgs({ picked: [], position: null }, { battleMapId: "bm", mapId: "m" }))
      .toEqual({ battleMapId: "bm", mapId: "m", elementIds: [] });
  });
});
