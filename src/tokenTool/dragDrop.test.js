import { addPart, joinParts, setPartGroup } from "./patterns/parts";
import { describe, it, expect } from "vitest";
import { pointToAnchorOffset, movePart, addPatternAt, freePlace } from "./dragDrop";
import character from "./fixtures/token_character.json";

// Drag and drop in the token editor: a part dropped or dragged on the preview is
// stored as the nearest of the token's 9 anchors plus an offset, as TokenManager places
// parts (anchor point + offsetX/offsetY = the part's own left/top).
const token = { x: 100, y: 100, size: 50 };

describe("pointToAnchorOffset", () => {
  it.each([
    [{ x: 98, y: 101 }, "left-top", -2, 1],
    [{ x: 125, y: 96 }, "top", 0, -4],
    [{ x: 151, y: 100 }, "right-top", 1, 0],
    [{ x: 100, y: 125 }, "left", 0, 0],
    [{ x: 127, y: 123 }, "center", 2, -2],
    [{ x: 150, y: 125 }, "right", 0, 0],
    [{ x: 100, y: 150 }, "left-bottom", 0, 0],
    [{ x: 125, y: 154 }, "bottom", 0, 4],
    [{ x: 160, y: 160 }, "right-bottom", 10, 10],
  ])("%o → %s", (point, anchor, offsetX, offsetY) => {
    expect(pointToAnchorOffset(point, token)).toEqual({ anchor, offsetX, offsetY });
  });

  it("offsets are whole pixels", () => {
    expect(pointToAnchorOffset({ x: 125.4, y: 154.6 }, token)).toEqual({ anchor: "bottom", offsetX: 0, offsetY: 5 });
  });

  it("follows the token's size (a 2×2 token)", () => {
    expect(pointToAnchorOffset({ x: 150, y: 210 }, { x: 100, y: 100, size: 100 })).toEqual({ anchor: "bottom", offsetX: 0, offsetY: 10 });
  });
});

describe("movePart", () => {
  const def = {
    name: "t", object: {},
    additions: [
      { name: "bar_bg", type: "rect", tokenData: { anchor: "bottom", offsetX: 0, offsetY: 4, maskGroup: "bar" } },
      { name: "bar_fill", type: "rect", tokenData: { anchor: "bottom", offsetX: 0, offsetY: 4, maskGroup: "bar" } },
      { name: "loose", type: "rect", tokenData: { anchor: "left-top", offsetX: 3, offsetY: 3 } },
      { name: "pair_a", type: "rect", tokenData: { anchor: "top", offsetX: 0, offsetY: 0, maskGroup: "pair" } },
      { name: "pair_b", type: "rect", tokenData: { anchor: "top", offsetX: 10, offsetY: 5, maskGroup: "pair" } },
      { name: "pair_c", type: "rect", tokenData: { anchor: "left", offsetX: 1, offsetY: 1, maskGroup: "pair" } },
    ],
  };
  const placementOf = (out, name) => {
    const { anchor, offsetX, offsetY } = out.additions.find((a) => a.name === name).tokenData;
    return { anchor, offsetX, offsetY };
  };

  it("moves the dragged part's whole group (a bar's background and fill)", () => {
    const out = movePart(def, "bar_fill", { anchor: "top", offsetX: 0, offsetY: -12 });
    expect(placementOf(out, "bar_bg")).toEqual({ anchor: "top", offsetX: 0, offsetY: -12 });
    expect(placementOf(out, "bar_fill")).toEqual({ anchor: "top", offsetX: 0, offsetY: -12 });
    expect(placementOf(out, "loose")).toEqual({ anchor: "left-top", offsetX: 3, offsetY: 3 });
  });

  it("a part without a group moves alone", () => {
    const out = movePart(def, "loose", { anchor: "center", offsetX: 0, offsetY: 0 });
    expect(placementOf(out, "loose")).toEqual({ anchor: "center", offsetX: 0, offsetY: 0 });
    expect(placementOf(out, "bar_bg")).toEqual({ anchor: "bottom", offsetX: 0, offsetY: 4 });
  });

  it("group members on the same anchor keep their distance; others stay", () => {
    const out = movePart(def, "pair_a", { anchor: "bottom", offsetX: 2, offsetY: 3 });
    expect(placementOf(out, "pair_b")).toEqual({ anchor: "bottom", offsetX: 12, offsetY: 8 });
    expect(placementOf(out, "pair_c")).toEqual({ anchor: "left", offsetX: 1, offsetY: 1 });
  });

  it("icons that stack at the top-right corner keep stacking wherever they're moved", () => {
    const out = movePart(character, "status_poisoned", { anchor: "left-bottom", offsetX: 0, offsetY: 2 });
    const moved = out.additions.filter((a) => a.tokenData.maskGroup === "conditions");
    expect(moved.every((a) => a.tokenData.stack === true && a.tokenData.anchor === "left-bottom")).toBe(true);
    // Other parts don't start stacking.
    expect(movePart(def, "loose", { anchor: "top", offsetX: 0, offsetY: 0 }).additions.find((a) => a.name === "loose").tokenData).not.toHaveProperty("stack");
  });

  it("leaves everything else as it was", () => {
    const out = movePart(character, "hp_bar_fill", { anchor: "top", offsetX: 0, offsetY: -10 });
    expect(out.additions).toHaveLength(character.additions.length);
    const untouched = (d) => d.additions.filter((a) => a.tokenData.maskGroup !== "hp");
    expect(untouched(out)).toEqual(untouched(character));
    expect(out.additions.find((a) => a.name === "hp_bar_fill").tokenData.propDeps).toEqual(
      character.additions.find((a) => a.name === "hp_bar_fill").tokenData.propDeps);
    expect(character.additions[0].tokenData.anchor).toBe("bottom");
  });
});

describe("addPatternAt", () => {
  it("adds the pattern's parts at the end, at the drop place, with a group of its own", () => {
    const out = addPatternAt(character, "bar", { anchor: "top", offsetX: 0, offsetY: -6 });
    const added = out.additions.slice(character.additions.length);
    expect(added.map((a) => a.name)).toEqual(["bar_bg", "bar_fill"]);
    expect(added[0].tokenData).toMatchObject({ anchor: "top", offsetX: 0, offsetY: -6, maskGroup: "bar" });
    expect(out.additions.slice(0, character.additions.length)).toEqual(character.additions);
  });

  it("a second one gets another group", () => {
    const once = addPatternAt({ name: "t", object: {}, additions: [] }, "label", { anchor: "bottom", offsetX: 0, offsetY: 0 });
    const twice = addPatternAt(once, "label", { anchor: "top", offsetX: 0, offsetY: 0 });
    expect(twice.additions.map((a) => a.tokenData.maskGroup)).toEqual(["label", "label2"]);
  });

  it("status icons offered in the picker join the token's assignable icons, with an id and property of their own", () => {
    const out = addPatternAt(character, "iconSet", { anchor: "left-top", offsetX: 0, offsetY: 0 });
    expect(out.assignableIcons).toHaveLength(character.assignableIcons.length + 1);
    expect(out.assignableIcons.slice(0, -1)).toEqual(character.assignableIcons);
    const added = out.assignableIcons.at(-1);
    expect(character.assignableIcons.some((i) => i.id === added.id || i.dtoProperty === added.dtoProperty)).toBe(false);
  });

  it("a ring always sits around the token, wherever it's dropped", () => {
    const out = addPatternAt({ name: "t", object: {}, additions: [] }, "ring", { anchor: "left-top", offsetX: 9, offsetY: 9 });
    expect(out.additions[0].tokenData).toMatchObject({ anchor: "center", offsetX: 0, offsetY: 0, fitToToken: true });
  });
});

describe("freePlace", () => {
  const def = { name: "t", object: {}, additions: [
    { name: "a", type: "rect", tokenData: { anchor: "bottom", offsetX: 0, offsetY: 4 } },
    { name: "b", type: "rect", tokenData: { anchor: "bottom", offsetX: 0, offsetY: 16 } },
  ] };

  it("a free place stays as it is", () => {
    expect(freePlace(def, { anchor: "top", offsetX: 0, offsetY: -4 })).toEqual({ anchor: "top", offsetX: 0, offsetY: -4 });
  });

  it("a taken place moves away from the token, 12 px at a time, until free", () => {
    expect(freePlace(def, { anchor: "bottom", offsetX: 0, offsetY: 4 })).toEqual({ anchor: "bottom", offsetX: 0, offsetY: 28 });
    const top = { ...def, additions: [{ name: "c", type: "rect", tokenData: { anchor: "top", offsetX: 0, offsetY: -4 } }] };
    expect(freePlace(top, { anchor: "top", offsetX: 0, offsetY: -4 })).toEqual({ anchor: "top", offsetX: 0, offsetY: -16 });
  });

  it("no placement (a ring) passes through", () => {
    expect(freePlace(def, { anchor: undefined, offsetX: undefined, offsetY: undefined })).toEqual({ anchor: undefined, offsetX: undefined, offsetY: undefined });
  });
});

// A mask group can hold several parts: a drag moves the dragged part, not its group.
describe("movePart in a shared mask group", () => {
  it("dragging the HP text leaves the HP bar where it is", () => {
    let parts = addPart(addPart([], "bar"), "label");
    parts = parts.map((p) => setPartGroup(p, { group: "hp", label: "HP" }));
    const file = joinParts({ name: "t", object: {} }, parts);
    const text = file.additions.find((a) => a.type === "text");
    const moved = movePart(file, text.name, { anchor: "top", offsetX: 0, offsetY: -20 });
    expect(moved.additions.find((a) => a.name === text.name).tokenData).toMatchObject({ anchor: "top", offsetY: -20 });
    for (const rect of moved.additions.filter((a) => a.type === "rect")) {
      expect(rect.tokenData).toMatchObject({ anchor: "bottom", offsetY: 4 });
    }
    // Dragging the bar's fill still takes its background along.
    const fill = moved.additions.find((a) => a.name.endsWith("_fill"));
    const again = movePart(moved, fill.name, { anchor: "left", offsetX: 2, offsetY: 0 });
    for (const rect of again.additions.filter((a) => a.type === "rect")) expect(rect.tokenData.anchor).toBe("left");
  });
});
