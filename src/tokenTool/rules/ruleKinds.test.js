import { describe, it, expect } from "vitest";
import { parseRule, buildRule, targetType, convertLegacy, RULE_KINDS } from "./ruleKinds";
import { evaluate } from "../../helpers/TokenExpressionEvaluator";
import character from "../fixtures/token_character.json";

// The one place that knows a rule's (propDep's) expression syntax: a rule as a kind with
// settings, and back. Every rule reads as something (raw Expression at worst), and what
// it builds is what the game's evaluator runs.

const props = (entries) => new Map(Object.entries(entries));
const rule = (kind, params, target = "width", source = "card") => ({ target, source, type: targetType(target), kind, params });
const roundTrip = (r) => expect(parseRule(buildRule(r))).toEqual(r);

describe("rule kinds", () => {
  it("Direct: a property as it is", () => {
    const r = rule("direct", { property: "name" }, "text");
    roundTrip(r);
    expect(buildRule(r)).toEqual({ objectProperty: "text", type: "string", source: "card", dtoProperty: "name" });
    // The %prop% form reads as Direct too.
    expect(parseRule({ objectProperty: "text", type: "string", source: "card", expression: "%name%" }).params).toEqual({ property: "name" });
  });

  it("Range: a value from one range onto another; ends are numbers or properties", () => {
    const r = rule("range", { property: "hp", from: ["0", "maxhp"], to: ["0", "100"] });
    roundTrip(r);
    expect(buildRule(r).expression).toBe("FromTo(%hp%, 0, %maxhp%, 0, 100)");
    expect(evaluate(buildRule(r).expression, props({ hp: "5", maxhp: "10" }), "number")).toBeCloseTo(50);
  });

  it("Thresholds: % of max to a value, the last also above max", () => {
    const r = rule("thresholds", { property: "hp", max: "maxhp", steps: [{ upTo: 25, value: "red" }, { upTo: 100, value: "green" }], fallback: "red" }, "fill");
    roundTrip(r);
    const at = (hp) => evaluate(buildRule(r).expression, props({ hp: String(hp), maxhp: "20" }), "string");
    expect([at(0), at(5), at(6), at(30)]).toEqual(["red", "red", "green", "green"]);
  });

  it("Table: a value per value of a property, and one for any other (optional)", () => {
    const r = rule("table", { property: "faction", entries: [{ when: "ally", value: "green" }, { when: "enemy", value: "red" }], other: "transparent" }, "stroke");
    roundTrip(r);
    const at = (faction) => evaluate(buildRule(r).expression, props({ faction }), "string");
    expect([at("ally"), at("enemy"), at("x")]).toEqual(["green", "red", "transparent"]);
    roundTrip(rule("table", { property: "faction", entries: [{ when: "ally", value: "green" }], other: "" }, "stroke"));
  });

  it("Formula: math over properties", () => {
    const r = rule("formula", { value: "0", formula: "%hp% / %maxhp% * 0.5 + 0.5" }, "opacity");
    roundTrip(r);
    expect(evaluate(buildRule(r).expression, props({ hp: "10", maxhp: "20" }), "number")).toBeCloseTo(0.75);
  });

  it("Formula: its first argument is `value` in the formula, and is kept (the Roll20 token's 'shown when it has a max')", () => {
    const dep = { objectProperty: "visible", type: "bool", source: "card", expression: "Math(0%bar2_max%, value > 0)" };
    const r = parseRule(dep);
    expect(r).toMatchObject({ kind: "formula", params: { value: "0%bar2_max%", formula: "value > 0" } });
    expect(buildRule(r)).toEqual(dep);
    expect(evaluate(buildRule(r).expression, props({ bar2_max: "5" }), "bool")).toBe(true);
    expect(evaluate(buildRule(r).expression, props({}), "bool")).toBe(false);
  });

  it("anything else is a raw Expression, kept as written (with its own type)", () => {
    for (const expression of ["%hp% of %maxhp%", "Unknown(1, 2)", "FromToEnum(%hp%, 5, %maxhp%, 0, 100, red, [])"]) {
      const dep = { objectProperty: "text", type: "string", source: "card", expression };
      expect(parseRule(dep)).toMatchObject({ kind: "expression", params: { text: expression } });
      expect(buildRule(parseRule(dep))).toEqual(dep);
    }
    const typed = { objectProperty: "custom", type: "number", source: "element", expression: "1" };
    expect(buildRule(parseRule(typed))).toEqual(typed);
  });

  it("the old dtoProperty + rule form is read-only, and converts to an expression that gives the same", () => {
    const dep = { objectProperty: "opacity", type: "number", source: "card", dtoProperty: "hp", rule: { name: "FromTo", arguments: { valueMin: 0, valueMax: 10, targetMin: 0.2, targetMax: 1 } } };
    const r = parseRule(dep);
    expect(r.kind).toBe("legacy");
    expect(buildRule(r)).toEqual(dep);
    const converted = convertLegacy(dep);
    expect(converted).toMatchObject({ objectProperty: "opacity", type: "number", source: "card", expression: "FromTo(%hp%, 0, 10, 0.2, 1)" });
    expect(converted).not.toHaveProperty("rule");
    expect(parseRule(converted).kind).toBe("range");
    expect(evaluate(converted.expression, props({ hp: "5" }), "number")).toBeCloseTo(0.6);
  });

  it("the dnd5e HP bar's rules read as a Range (width) and Thresholds (colour)", () => {
    const fill = character.additions.find((a) => a.name === "hp_bar_fill");
    const [width, colour] = fill.tokenData.propDeps.map(parseRule);
    expect(width).toMatchObject({ kind: "range", params: { property: "hp", from: ["0", "maxhp"] } });
    expect(colour).toMatchObject({ kind: "thresholds", params: { property: "hp", max: "maxhp" } });
    expect(colour.params.steps.map((s) => s.upTo)).toEqual([25, 50, 100]);
  });

  it("the value type follows the target", () => {
    expect(["fill", "stroke", "text", "visible", "opacity", "width", "angle", "fontSize", "somethingElse"].map(targetType))
      .toEqual(["string", "string", "string", "bool", "number", "number", "number", "number", "string"]);
  });

  it("every kind has a title for the editor", () => {
    for (const kind of Object.values(RULE_KINDS)) expect(kind.title).toBeTruthy();
  });
});
