import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { fabric } from "fabric";

vi.mock("../helpers/transport", () => import("./ToolTransport"));

import { createPreviewSession } from "./previewSession";
import { registerPreviewPanels } from "./previewPanels";
import { stubCanvasContext, fakeCanvas } from "./testCanvas";
import character from "./fixtures/token_character.json";
import { addPart, joinParts, updatePart, setPartGroup, setPartRules } from "./patterns/parts";

// The token editor's preview: the real TokenManager draws the token file on a canvas,
// with sample values for its properties instead of a game's.

// jsdom loads no pictures: a square stands in for the token image.
const enlivenAsRect = async (object) => new fabric.Rect({ ...object, type: "rect", fill: "#888" });

describe("previewSession", () => {
  let state, log, dispose, session, canvas;

  beforeEach(() => {
    stubCanvasContext();
    state = { values: { card: { hp: "5", maxhp: "10", character_name: "Aria", status_poisoned: "true" }, element: {} }, gridSize: 50, isGM: true };
    log = [];
    ({ dispose } = registerPreviewPanels({ get: () => state, onEvent: (l) => log.push(l) }));
    canvas = fakeCanvas();
  });
  afterEach(() => { session?.dispose(); dispose(); vi.restoreAllMocks(); });

  const open = async (definition = character, options = {}) => {
    session = createPreviewSession({ canvas, enliven: enlivenAsRect });
    await session.place(definition, { gridSize: 50, ...options });
    return session;
  };
  const part = (name) => session.token().additionalObjects.find((o) => o.name === name);

  it("draws every part of the dnd5e character token, in the middle of the canvas", async () => {
    await open();
    const token = session.token();
    expect(token.additionalObjects).toHaveLength(character.additions.length);
    expect([token.left, token.top, token.width]).toEqual([125, 125, 50]);
  });

  it("binds parts to the sample values and follows a change", async () => {
    await open();
    expect(part("hp_bar_fill").width).toBeCloseTo(50);
    expect(part("name_label").text).toBe("Aria");
    expect(part("status_poisoned").visible).toBe(true);
    expect(part("status_blinded").visible).toBe(false);

    state.values.card.hp = "10";
    state.values.card.status_blinded = "true";
    await session.refresh();
    expect(part("hp_bar_fill").width).toBeCloseTo(100);
    expect(part("status_blinded").visible).toBe(true);
  });

  it("selected shows the parts that appear on token control", async () => {
    await open();
    expect(part("open_card_btn").visible).toBe(false);
    await session.setSelected(true);
    expect(part("open_card_btn").visible).toBe(true);
    await session.setSelected(false);
    expect(part("open_card_btn").visible).toBe(false);
  });

  it("a GM-only mask hides the part from a player", async () => {
    state.values.element = { mask_hp_gmonly: "true" };
    await open();
    expect(part("hp_bar_fill").visible).toBe(true);
    state.isGM = false;
    await session.refresh();
    expect(part("hp_bar_fill").visible).toBe(false);
  });

  it("placing again replaces the token and its parts; size follows the chosen cells", async () => {
    await open();
    await session.place({ name: "t", object: { type: "image" }, additions: [{ name: "only", type: "rect", width: 10, height: 4 }] }, { gridSize: 50, size: 2 });
    expect(canvas.getObjects()).toHaveLength(2);
    expect(session.token().width).toBe(100);
  });

  it("a newer place wins over one still loading, leaving no parts of the older token", async () => {
    session = createPreviewSession({ canvas, enliven: enlivenAsRect });
    const small = { name: "a", object: { type: "image" }, additions: [{ name: "a1", type: "rect", width: 4, height: 4 }, { name: "a2", type: "rect", width: 4, height: 4 }] };
    const big = { name: "b", object: { type: "image" }, additions: [{ name: "b1", type: "rect", width: 4, height: 4 }] };
    await Promise.all([session.place(small, { gridSize: 50 }), session.place(big, { gridSize: 50, size: 2 })]);
    expect(canvas.getObjects().map((o) => o.name).sort()).toEqual(["Token", "b1"]);
    expect(session.token().width).toBe(100);
  });

  it("dispose while placing leaves the canvas empty", async () => {
    session = createPreviewSession({ canvas, enliven: enlivenAsRect });
    const placing = session.place(character, { gridSize: 50 });
    session.dispose();
    await placing;
    session = null;
    expect(canvas.getObjects()).toEqual([]);
  });

  it("parts made from patterns draw as they should: a bar and a ring on a 2×2 token", async () => {
    let parts = addPart([], "bar");
    parts = addPart(parts, "ring");
    await open(joinParts({ name: "t", object: { type: "image" } }, parts), { size: 2 });
    expect(part("bar_fill").width).toBeCloseTo(50); // hp 5 of 10, bar 100 wide
    // The ring's line runs along the token's edge (its stroke isn't scaled: strokeUniform).
    expect(part("ring").width * part("ring").scaleX).toBeCloseTo(100);
    expect(part("ring").visible).toBe(true);
  });

  it("shapes draw as Fabric shapes, scaled and turned; one shown by a property follows it", async () => {
    let parts = addPart([], "rect");
    parts = addPart(parts, "circle");
    parts = addPart(parts, "polygon");
    const [rect, circle, polygon] = parts;
    const turned = [
      updatePart(rect, { ...rect.params, rotation: 45, scale: 2 }),
      updatePart(circle, { ...circle.params, property: "status_marked" }),
      polygon,
    ];
    state.values.card.status_marked = "false";
    await open(joinParts({ name: "t", object: { type: "image" } }, turned));
    expect(part("rect")).toBeInstanceOf(fabric.Rect);
    expect([part("rect").angle, part("rect").scaleX]).toEqual([45, 2]);
    expect(part("polygon")).toBeInstanceOf(fabric.Polygon);
    expect(part("polygon").points).toHaveLength(6);
    expect(part("circle")).toBeInstanceOf(fabric.Circle);
    expect(part("circle").visible).toBe(false);
    state.values.card.status_marked = "true";
    await session.refresh();
    expect(part("circle").visible).toBe(true);
  });

  it("a mask group hidden on the map hides all its parts (two parts sharing it); the token's own setting wins", async () => {
    const [bar, label] = addPart(addPart([], "bar"), "label");
    const shared = [setPartGroup(bar, { group: "hp", label: "HP" }), setPartGroup(label, { group: "hp", label: "HP" })];
    state.values.map = { mask_hp_enabled: "false", mask_hp_gmonly: "false" };
    await open(joinParts({ name: "t", object: { type: "image" } }, shared));
    const hp = session.token().additionalObjects.filter((o) => o.tokenData?.maskGroup === "hp");
    expect(hp).toHaveLength(3);
    expect(hp.map((o) => o.visible)).toEqual([false, false, false]);

    state.values.element.mask_hp_enabled = "true";
    await session.refresh();
    expect(hp.every((o) => o.visible)).toBe(true);
  });

  it("a ring coloured by a rule: its colour for a known value, none for others", async () => {
    const [ring] = addPart([], "ring");
    const coloured = setPartRules(ring, [{ expression: 'Enum(%faction%, {"ally":"#00ff00"}, transparent)', objectProperty: "stroke", type: "string", source: "card" }]);
    state.values.card.faction = "ally";
    await open(joinParts({ name: "t", object: { type: "image" } }, [coloured]));
    const stroke = () => part("ring").stroke;
    expect(stroke()).toBe("#00ff00");
    for (const other of ["enemy", undefined]) {
      state.values.card.faction = other;
      await session.refresh();
      expect([other, stroke()]).toEqual([other, "transparent"]);
    }
  });

  it("bar colours with spaces and commas (rgb(1, 2, 3)) and hex both come through", async () => {
    const [bar] = addPart([], "bar");
    const colours = updatePart(bar, { ...bar.params, colors: [{ upTo: 50, color: "rgb(1, 2, 3)" }, { upTo: 100, color: "#00ff00" }] });
    await open(joinParts({ name: "t", object: { type: "image" } }, [colours]));
    state.values.card.hp = "8";
    await session.refresh();
    expect(part("bar_fill").fill).toBe("#00ff00");
    state.values.card.hp = "2";
    await session.refresh();
    expect(part("bar_fill").fill).toBe("rgb(1, 2, 3)");
    state.values.card.hp = "0";
    await session.refresh();
    expect(part("bar_fill").fill).toBe("rgb(1, 2, 3)");
  });

  it("tokenRect: where the token is shown and how big", async () => {
    await open(character, { size: 2 });
    expect(session.tokenRect()).toEqual({ x: 100, y: 100, size: 100 });
  });

  it("arrange mode: parts can be dragged; a drag ends as the part's new anchor and offset", async () => {
    await open();
    const moved = vi.fn();
    session.setArrange(true, moved);
    const label = part("name_label");
    expect([label.selectable, label.hasControls]).toEqual([true, false]);

    label.set({ left: 150, top: 185 }); // under the token's middle (bottom edge at 175), 10 px lower
    canvas.fire("object:modified", { target: label });
    expect(moved).toHaveBeenCalledWith("name_label", { anchor: "bottom", offsetX: 0, offsetY: 10 });

    canvas.fire("object:modified", { target: session.token() });
    expect(moved).toHaveBeenCalledTimes(1);

    session.setArrange(false);
    expect(label.selectable).toBe(false);
    canvas.fire("object:modified", { target: label });
    expect(moved).toHaveBeenCalledTimes(1);
  });

  // Fabric finds what's under the pointer by each object's stored corners (setCoords).
  // TokenManager moves parts by setting left/top only; in a game the map's pan and zoom
  // refresh the corners, the preview has to do it itself, or the parts can't be grabbed.
  it("parts can be found where they're drawn: their corners follow their place", async () => {
    await open();
    session.setArrange(true, vi.fn());
    const label = part("name_label");
    expect(label.aCoords.tl.y).toBeCloseTo(label.top);
    expect(label.aCoords.tl.x).toBeCloseTo(label.left - label.getScaledWidth() / 2);

    await session.setSelected(true);
    const button = part("open_card_btn");
    expect(button.aCoords.br.y).toBeCloseTo(button.top);
  });

  it("arrange mode carries over to a token placed again", async () => {
    await open();
    session.setArrange(true, vi.fn());
    await session.place(character, { gridSize: 50 });
    expect(part("name_label").selectable).toBe(true);
  });

  it("dispose takes everything off the canvas", async () => {
    await open();
    session.dispose();
    session = null;
    expect(canvas.getObjects()).toEqual([]);
  });
});
