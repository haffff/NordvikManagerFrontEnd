import { describe, it, expect } from "vitest";
import { summarizeStep, parseTemplate, shortValue, humanizeArgName } from "./stepSummary";

const rollDef = { name: "Roll Dice", summary: "Roll {DiceString}[ → {OutputVariable}]", arguments: [] };

describe("summarizeStep", () => {
  it("fills placeholders and keeps optional parts that have values", () => {
    const s = summarizeStep({ Type: "RollDice", Data: { DiceString: "1d20+3", OutputVariable: "roll" } }, rollDef);
    expect(s.text).toBe("Roll 1d20+3 → roll");
  });

  it("drops optional parts whose placeholder is empty", () => {
    const s = summarizeStep({ Type: "RollDice", Data: { DiceString: "2d6" } }, rollDef);
    expect(s.text).toBe("Roll 2d6");
  });

  it("marks a missing required argument", () => {
    const s = summarizeStep({ Type: "RollDice", Data: {} }, rollDef);
    expect(s.segments).toContainEqual({ kind: "missing", text: "DiceString" });
    expect(s.text).toBe("Roll ‹DiceString›");
  });

  it("highlights %tokens% inside values", () => {
    const s = summarizeStep({ Type: "RollDice", Data: { DiceString: "1d20+(%modifier%)" } }, rollDef);
    expect(s.segments).toEqual([
      { kind: "text", text: "Roll " },
      { kind: "value", text: "1d20+(" },
      { kind: "token", text: "%modifier%" },
      { kind: "value", text: ")" },
    ]);
  });

  it("shows the first line of multi-line values", () => {
    const def = { summary: "Script {Script}[ → {Output}]" };
    const s = summarizeStep({ Type: "RunScript", Data: { Script: "const a = 1;\nreturn { a };" } }, def);
    expect(s.text).toBe("Script const a = 1; …");
  });

  it("falls back to name and first filled arguments without a template", () => {
    const def = { name: "Mystery", arguments: [{ name: "A" }, { name: "B" }, { name: "C" }] };
    const s = summarizeStep({ Type: "X", Data: { A: "", B: "two", C: "%x%" } }, def);
    expect(s.text).toBe("Mystery · B two, C %x%");
  });

  it("handles unknown step types", () => {
    expect(summarizeStep({ Type: "Gone", Data: { Foo: "bar" } }, undefined).text).toBe("Gone · Foo bar");
  });
});

describe("helpers", () => {
  it("parses nested template parts", () => {
    expect(parseTemplate("Ask[ {User}]: {Message}")).toEqual([
      { text: "Ask" },
      { optional: [{ text: " " }, { arg: "User" }] },
      { text: ": " },
      { arg: "Message" },
    ]);
  });

  it("truncates long values", () => {
    expect(shortValue("x".repeat(100))).toHaveLength(48);
  });

  it("humanizes argument names", () => {
    expect(humanizeArgName("DiceString")).toBe("Dice string");
    expect(humanizeArgName("OutputVariable")).toBe("Output variable");
    expect(humanizeArgName("ParentId")).toBe("Parent id");
    expect(humanizeArgName("UserID")).toBe("User id");
  });
});
