import * as React from "react";
import { vi, describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Provider } from "../../components/ui/provider";
import { RulesEditor } from "./RulesEditor";

// A part's (or the token picture's) own rules: each sets one object property from a game
// property, directly or through a range, thresholds, a value table or a formula. Locked
// rows are what the part's pattern sets itself.

function Harness({ initial, onChange, locked, targets }) {
  const [rules, setRules] = React.useState(initial);
  return <RulesEditor rules={rules} locked={locked} targets={targets} onChange={(next) => { onChange(next); setRules(next); }} />;
}
const TARGETS = ["opacity", "fill", "text", "angle", "visible"];
const setup = (initial = [], { locked = [], targets = TARGETS } = {}) => {
  const onChange = vi.fn();
  render(<Provider><Harness initial={initial} onChange={onChange} locked={locked} targets={targets} /></Provider>);
  return { last: () => onChange.mock.lastCall[0], onChange };
};
const ruleRow = (target) => screen.getByRole("group", { name: `Rule: ${target}` });
const change = (row, label, value) => fireEvent.change(within(row).getByLabelText(label), { target: { value } });

describe("RulesEditor", () => {
  it("+ Rule adds a Direct rule on the first target not used yet, read from the card", () => {
    const { last } = setup([], { locked: [{ target: "text", by: "Label" }] });
    fireEvent.click(screen.getByRole("button", { name: "Add rule" }));
    expect(last()).toEqual([{ objectProperty: "opacity", type: "number", source: "card", dtoProperty: "" }]);
    change(ruleRow("opacity"), "Property", "hp");
    expect(last()[0].dtoProperty).toBe("hp");
    expect(within(ruleRow("opacity")).getByText("%hp%")).toBeInTheDocument();
  });

  it("another kind keeps the property read; a Range is written as FromTo", () => {
    const { last } = setup([{ objectProperty: "opacity", type: "number", source: "card", dtoProperty: "hp" }]);
    change(ruleRow("opacity"), "As", "range");
    change(ruleRow("opacity"), "From max", "maxhp");
    change(ruleRow("opacity"), "To min", "0.3");
    expect(last()[0].expression).toBe("FromTo(%hp%, 0, %maxhp%, 0.3, 1)");
    expect(within(ruleRow("opacity")).getByText("FromTo(%hp%, 0, %maxhp%, 0.3, 1)")).toBeInTheDocument();
  });

  it("a kind stays while a field is emptied (it isn't read back as something else)", () => {
    setup([{ objectProperty: "opacity", type: "number", source: "card", expression: "FromTo(%hp%, 0, %maxhp%, 0, 1)" }]);
    change(ruleRow("opacity"), "From max", "");
    expect(within(ruleRow("opacity")).getByLabelText("As")).toHaveValue("range");
  });

  it("a new target gives the rule its value type; the source can change", () => {
    const { last } = setup([{ objectProperty: "opacity", type: "number", source: "card", dtoProperty: "hp" }]);
    change(ruleRow("opacity"), "Set", "text");
    change(ruleRow("text"), "From", "element");
    expect(last()[0]).toMatchObject({ objectProperty: "text", type: "string", source: "element" });
  });

  it("a value table on a colour: rows of value → colour (with the colour picker), and one for any other", () => {
    const { last } = setup([{ objectProperty: "fill", type: "string", source: "card", dtoProperty: "faction" }]);
    change(ruleRow("fill"), "As", "table");
    const row = ruleRow("fill");
    fireEvent.change(within(row).getAllByLabelText("When")[0], { target: { value: "ally" } });
    fireEvent.change(within(row).getAllByLabelText("Value")[0], { target: { value: "green" } });
    change(row, "Otherwise", "grey");
    expect(last()[0].expression).toBe('Enum(%faction%, {"ally":"green"}, grey)');
    expect(row.querySelector("[data-scope='color-picker']")).not.toBeNull();
  });

  it("thresholds: steps in % of max", () => {
    const { last } = setup([{ objectProperty: "fill", type: "string", source: "card", dtoProperty: "hp" }]);
    change(ruleRow("fill"), "As", "thresholds");
    change(ruleRow("fill"), "Max", "maxhp");
    expect(last()[0].expression).toMatch(/^FromToEnum\(%hp%, 0, %maxhp%, 0, 100, red, \[/);
  });

  it("a formula and a raw expression are written as typed", () => {
    const { last } = setup([{ objectProperty: "angle", type: "number", source: "card", dtoProperty: "facing" }]);
    change(ruleRow("angle"), "As", "formula");
    change(ruleRow("angle"), "Formula", "%facing% * 45");
    expect(last()[0].expression).toBe("Math(0, %facing% * 45)");
    change(ruleRow("angle"), "As", "expression");
    change(ruleRow("angle"), "Expression", "%facing%0");
    expect(last()[0].expression).toBe("%facing%0");
  });

  it("a rule is removed", () => {
    const { last } = setup([{ objectProperty: "opacity", type: "number", source: "card", dtoProperty: "hp" }]);
    fireEvent.click(within(ruleRow("opacity")).getByRole("button", { name: "Remove rule" }));
    expect(last()).toEqual([]);
  });

  it("locked rows: what the pattern sets, read-only, and not offered as a target", () => {
    setup([], { locked: [{ target: "text", by: "Label" }] });
    expect(screen.getByRole("group", { name: "Locked rule: text" })).toHaveTextContent(/set by the Label's settings/);
    fireEvent.click(screen.getByRole("button", { name: "Add rule" }));
    const options = [...document.querySelectorAll("datalist option")].map((o) => o.value);
    expect(options).not.toContain("text");
  });

  it("a target the pattern sets can't be typed in either", () => {
    const { last } = setup([{ objectProperty: "opacity", type: "number", source: "card", dtoProperty: "hp" }], { locked: [{ target: "text", by: "Label" }] });
    change(ruleRow("opacity"), "Set", "text");
    expect(last).toBeDefined();
    expect(within(ruleRow("opacity")).getByText(/set by the part's settings/)).toBeInTheDocument();
  });

  it("the old dtoProperty + rule form is read-only, and converts to an expression", () => {
    const { last } = setup([{ objectProperty: "opacity", type: "number", source: "card", dtoProperty: "hp", rule: { name: "FromTo", arguments: { valueMin: 0, valueMax: 10, targetMin: 0.2, targetMax: 1 } } }]);
    const row = ruleRow("opacity");
    expect(within(row).getByText(/Old syntax/)).toBeInTheDocument();
    expect(within(row).queryByLabelText("Property")).toBeNull();
    fireEvent.click(within(row).getByRole("button", { name: "Convert" }));
    expect(last()[0].expression).toBe("FromTo(%hp%, 0, 10, 0.2, 1)");
    expect(within(ruleRow("opacity")).getByLabelText("As")).toHaveValue("range");
  });

  it("a rule changed from outside (the JSON) is shown as it now is", () => {
    const { rerender } = render(<Provider><RulesEditor rules={[{ objectProperty: "opacity", type: "number", source: "card", dtoProperty: "hp" }]} onChange={() => {}} targets={TARGETS} /></Provider>);
    rerender(<Provider><RulesEditor rules={[{ objectProperty: "angle", type: "number", source: "card", dtoProperty: "facing" }]} onChange={() => {}} targets={TARGETS} /></Provider>);
    expect(within(ruleRow("angle")).getByLabelText("Property")).toHaveValue("facing");
  });
});
