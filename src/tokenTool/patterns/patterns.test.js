import { describe, it, expect } from "vitest";
import { PATTERNS } from "./index";

// One-click token parts. Each pattern builds its parts from a few settings, and knows
// its own parts again in a token file (by their shared maskGroup), so a file made or
// edited by hand still opens as the same settings.
const context = (built) => ({ assignableIcons: built.assignableIcons ?? [] });
const roundTrip = (pattern, params) => {
  const built = pattern.build(params);
  return pattern.match(built.additions, context(built));
};

describe.each(Object.values(PATTERNS).map((p) => [p.id, p]))("%s", (_, pattern) => {
  it("its defaults build parts it recognises as the same settings", () => {
    const params = pattern.create({ group: "g1" });
    expect(roundTrip(pattern, params)).toEqual(params);
  });

  it("every part carries the group, for masking and for being found again", () => {
    const { additions } = pattern.build(pattern.create({ group: "g1", label: "Mine" }));
    expect(additions.length).toBeGreaterThan(0);
    for (const a of additions) expect(a.tokenData).toMatchObject({ maskGroup: "g1", label: "Mine" });
    expect(new Set(additions.map((a) => a.name)).size).toBe(additions.length);
  });

  it("doesn't claim another pattern's parts", () => {
    for (const other of Object.values(PATTERNS)) {
      if (other === pattern) continue;
      const built = other.build(other.create({ group: "g2" }));
      expect(pattern.match(built.additions, context(built))).toBeNull();
    }
  });
});

describe("bar", () => {
  const bar = PATTERNS.bar;

  it("width follows value/max, colour the thresholds (in % of max)", () => {
    const params = { ...bar.create({ group: "hp" }), value: "hp", max: "maxhp", width: 80, colors: [{ upTo: 30, color: "red" }, { upTo: 100, color: "green" }] };
    const [, fill] = bar.build(params).additions;
    expect(fill.tokenData.propDeps).toEqual([
      { expression: "FromTo(%hp%, 0, %maxhp%, 0, 80)", objectProperty: "width", type: "number", source: "card" },
      { expression: 'FromToEnum(%hp%, 0, %maxhp%, 0, 100, red, [{"min":0,"max":30,"enumValue":"red"},{"min":30,"max":9999,"enumValue":"green"}])', objectProperty: "fill", type: "string", source: "card" },
    ]);
    expect(roundTrip(bar, params)).toEqual(params);
  });
});

describe("iconSet", () => {
  const set = PATTERNS.iconSet;

  it("offered in the token's icon picker: an assignable icon per part, on the same property", () => {
    const params = { ...set.create({ group: "conditions" }), inPicker: true, icons: [{ id: "poisoned", label: "Poisoned", iconPack: "gi", iconName: "GiPoisonBottle", color: "green", property: "status_poisoned" }] };
    const built = set.build(params);
    expect(built.assignableIcons).toEqual([{ id: "poisoned", label: "Poisoned", iconPack: "gi", iconName: "GiPoisonBottle", dtoProperty: "status_poisoned", source: "card" }]);
    expect(built.additions[0].tokenData.propDeps).toEqual([{ dtoProperty: "status_poisoned", objectProperty: "visible", type: "bool", source: "card" }]);
    expect(roundTrip(set, params)).toEqual(params);
  });

  it("its icons stack: the ones turned on line up from the set's place, wherever it is", () => {
    const built = set.build({ ...set.create({ group: "x" }), anchor: "left-bottom" });
    expect(built.additions[0].tokenData).toMatchObject({ anchor: "left-bottom", stack: true });
  });

  it("not in the picker: no assignable icons", () => {
    expect(set.build({ ...set.create({ group: "x" }), inPicker: false }).assignableIcons).toEqual([]);
  });
});

describe("ring", () => {
  const ring = PATTERNS.ring;

  it("fits the token and can take its colour from a property, transparent (no ring) for other values", () => {
    const params = { ...ring.create({ group: "faction" }), property: "faction", colors: { ally: "green", enemy: "red" } };
    const [part] = ring.build(params).additions;
    expect(part.tokenData).toMatchObject({ anchor: "center", fitToToken: true });
    expect(part.tokenData.propDeps).toEqual([{ expression: 'Enum(%faction%, {"ally":"green","enemy":"red"}, transparent)', objectProperty: "stroke", type: "string", source: "card" }]);
    expect(roundTrip(ring, params)).toEqual(params);
  });
});

// Scale and rotation: every part a pattern makes takes them, except a ring (it fits the
// token, and turning a circle shows nothing). Icons are sized by their own size setting.
describe("scale and rotation", () => {
  const scalable = ["bar", "label", "rect", "circle", "polygon"];
  const turnable = [...scalable, "button", "iconSet"];

  it.each(turnable)("%s: a rotation turns every part, and is read back", (id) => {
    const pattern = PATTERNS[id];
    const params = { ...pattern.create({ group: "g" }), rotation: 30 };
    const { additions } = pattern.build(params);
    for (const a of additions) expect(a.angle).toBe(30);
    expect(roundTrip(pattern, params)).toEqual(params);
  });

  it.each(scalable)("%s: a scale scales every part, and is read back", (id) => {
    const pattern = PATTERNS[id];
    const params = { ...pattern.create({ group: "g" }), scale: 1.5 };
    const { additions } = pattern.build(params);
    for (const a of additions) expect([a.scaleX, a.scaleY]).toEqual([1.5, 1.5]);
    expect(roundTrip(pattern, params)).toEqual(params);
  });

  it.each(turnable)("%s: unturned and unscaled, the parts don't say so", (id) => {
    const pattern = PATTERNS[id];
    for (const a of pattern.build(pattern.create({ group: "g" })).additions) {
      expect(a).not.toHaveProperty("angle");
      expect(a).not.toHaveProperty("scaleX");
    }
  });

  it("icons have no scale (their size is it); a ring has neither", () => {
    for (const id of ["button", "iconSet"]) expect(PATTERNS[id].create({ group: "g" })).not.toHaveProperty("scale");
    expect(PATTERNS.ring.create({ group: "g" })).not.toHaveProperty("rotation");
    expect(PATTERNS.ring.create({ group: "g" })).not.toHaveProperty("scale");
  });
});

// Primitives: a rectangle, a circle or a regular polygon, always shown or only while a
// yes/no property is on.
describe("shapes", () => {
  it("a rectangle: size, rounded corners, fill and outline", () => {
    const params = { ...PATTERNS.rect.create({ group: "r" }), width: 30, height: 12, corner: 4, fill: "red", stroke: "black", strokeWidth: 2 };
    const [part] = PATTERNS.rect.build(params).additions;
    expect(part).toMatchObject({ type: "rect", width: 30, height: 12, rx: 4, ry: 4, fill: "red", stroke: "black", strokeWidth: 2, originX: "center", originY: "center" });
    expect(roundTrip(PATTERNS.rect, params)).toEqual(params);
  });

  it("a circle: its size is the diameter", () => {
    const params = { ...PATTERNS.circle.create({ group: "c" }), width: 20 };
    const [part] = PATTERNS.circle.build(params).additions;
    expect(part).toMatchObject({ type: "circle", radius: 10 });
    expect(roundTrip(PATTERNS.circle, params)).toEqual(params);
  });

  it("a polygon: regular, with as many corners as sides, the first at the top", () => {
    const params = { ...PATTERNS.polygon.create({ group: "p" }), sides: 6, width: 20, height: 20 };
    const [part] = PATTERNS.polygon.build(params).additions;
    expect(part.type).toBe("polygon");
    expect(part.points).toHaveLength(6);
    expect(part.points[0]).toEqual({ x: 0, y: -10 });
    expect(roundTrip(PATTERNS.polygon, params)).toEqual(params);
  });

  it("a polygon drawn by hand isn't taken for a regular one", () => {
    const params = { ...PATTERNS.polygon.create({ group: "p" }), sides: 4 };
    const [part] = PATTERNS.polygon.build(params).additions;
    const odd = { ...part, points: [{ x: 0, y: 0 }, { x: 9, y: 1 }, { x: 3, y: 7 }, { x: -2, y: 5 }] };
    expect(PATTERNS.polygon.match([odd])).toBeNull();
  });

  it.each(["rect", "circle", "polygon"])("%s: shown only while a yes/no property is on", (id) => {
    const params = { ...PATTERNS[id].create({ group: "s" }), property: "status_marked", source: "element" };
    const [part] = PATTERNS[id].build(params).additions;
    expect(part.visible).toBe(false);
    expect(part.tokenData.propDeps).toEqual([{ dtoProperty: "status_marked", objectProperty: "visible", type: "bool", source: "element" }]);
    expect(roundTrip(PATTERNS[id], params)).toEqual(params);
  });
});
