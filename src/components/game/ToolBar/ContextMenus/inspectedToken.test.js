import { describe, it, expect } from "vitest";
import { inspectedToken } from "./inspectedToken";

// The token a right-click opens a read-only menu for: one this player sees but can't select.
describe("inspectedToken", () => {
  const seeOnly = { id: "t1", isToken: true, selectable: false };
  const canvas = (active, lastClickTarget) => ({ getActiveObjects: () => active, lastClickTarget });

  it("is the token under the pointer when nothing is selected and it can't be selected", () => {
    expect(inspectedToken(canvas([], seeOnly))).toBe(seeOnly);
  });

  it("is none with something selected, one or several", () => {
    expect(inspectedToken(canvas([{ id: "a" }], seeOnly))).toBeNull();
    expect(inspectedToken(canvas([{ id: "a" }, { id: "b" }], seeOnly))).toBeNull();
  });

  it("is none for a token the player can select (they select it for the full menu)", () => {
    expect(inspectedToken(canvas([], { ...seeOnly, selectable: true }))).toBeNull();
  });

  it("is none for an element that isn't a token, or for empty map", () => {
    expect(inspectedToken(canvas([], { id: "e1", selectable: false }))).toBeNull();
    expect(inspectedToken(canvas([], null))).toBeNull();
    expect(inspectedToken(null)).toBeNull();
  });
});
