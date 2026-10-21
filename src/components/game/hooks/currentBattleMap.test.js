import { describe, it, expect } from "vitest";
import { currentBattleMap } from "./currentBattleMap";

const mapOf = { a: "map-a", b: "map-b" };

describe("currentBattleMap", () => {
  it("is the selected view and the map it shows", () => {
    expect(currentBattleMap("b", { a: { id: "a" }, b: { id: "b" } }, (id) => mapOf[id])).toEqual({ battleMapId: "b", mapId: "map-b" });
  });

  it("is the first open view when none is selected", () => {
    expect(currentBattleMap(undefined, { a: { id: "a" } }, (id) => mapOf[id])).toEqual({ battleMapId: "a", mapId: "map-a" });
  });

  it("is nothing when no view is open", () => {
    expect(currentBattleMap(undefined, {}, () => "x")).toBeUndefined();
  });
});
