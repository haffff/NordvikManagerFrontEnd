import * as React from "react";
import { vi, describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Provider } from "../components/ui/provider";
import { PartsPanel } from "./PartsPanel";
import character from "./fixtures/token_character.json";
import { addPart, joinParts, setPartGroup } from "./patterns/parts";

// The token editor's part list: each part of the token file with its settings, to
// change, remove or reorder. Every change gives the whole token file back.
// Like the page: the file the panel gives back is the one it shows next.
function Harness({ initial, onChange }) {
  const [definition, setDefinition] = React.useState(initial);
  return <PartsPanel definition={definition} onChange={(next) => { onChange(next); setDefinition(next); }} />;
}
const setup = (definition = character) => {
  const onChange = vi.fn();
  const utils = render(<Provider><Harness initial={definition} onChange={onChange} /></Provider>);
  return { onChange, ...utils, last: () => onChange.mock.lastCall[0] };
};
const partItem = (title) => screen.getByRole("group", { name: title });
const open = (title) => fireEvent.click(within(partItem(title)).getByRole("button", { name: /settings/i }));

describe("PartsPanel", () => {
  it("lists the dnd5e token's parts by what they are", () => {
    setup();
    for (const title of ["Bar: hp_bar", "Label: name_label", "Button: open_card_btn", "Status icons: counter_icon", "Status icons: status"]) {
      expect(partItem(title)).toBeInTheDocument();
    }
  });

  it("parts no pattern knows are listed as custom (edited in the JSON)", () => {
    setup({ name: "t", object: {}, additions: [{ name: "odd", type: "triangle" }] });
    expect(partItem("Custom: odd")).toHaveTextContent(/JSON/);
  });

  it("a changed setting changes the file (bar width)", () => {
    const { last } = setup();
    open("Bar: hp_bar");
    fireEvent.change(within(partItem("Bar: hp_bar")).getByLabelText("Width"), { target: { value: "60" } });
    const bg = last().additions.find((a) => a.name === "hp_bar_bg");
    expect(bg.width).toBe(60);
    expect(last().additions).toHaveLength(character.additions.length);
  });

  it("removing a part removes its parts and the icons it offered", () => {
    const { last } = setup();
    fireEvent.click(within(partItem("Status icons: status")).getByRole("button", { name: "Remove" }));
    expect(last().additions.some((a) => a.name.startsWith("status_"))).toBe(false);
    expect(last().assignableIcons).toEqual([]);
  });

  it("parts move up and down (drawing order)", () => {
    const { last } = setup();
    fireEvent.click(within(partItem("Label: name_label")).getByRole("button", { name: "Move up" }));
    expect(last().additions.slice(0, 3).map((a) => a.name)).toEqual(["name_label", "hp_bar_bg", "hp_bar_fill"]);
  });

  it("an icon set: add an icon, change one", () => {
    const { last } = setup();
    open("Status icons: status");
    const item = partItem("Status icons: status");
    fireEvent.click(within(item).getByRole("button", { name: "Add icon" }));
    expect(last().additions.at(-1).tokenData.maskGroup).toBe("conditions");
    expect(last().assignableIcons).toHaveLength(character.assignableIcons.length + 1);
  });

  it("settings are a table in sections: what it shows, how it looks, where it sits", () => {
    setup();
    open("Label: name_label");
    const item = partItem("Label: name_label");
    const sections = within(item).getAllByRole("rowheader").map((h) => h.textContent);
    expect(sections).toEqual(["Part", "Content", "Appearance", "Placement"]);
    // A label and its control on each row.
    expect(within(item).getByRole("row", { name: /Font size/ })).toContainElement(within(item).getByLabelText("Font size"));
  });

  it("parts can be scaled and turned (icons only turned: their size is their scale)", () => {
    const { last } = setup();
    open("Label: name_label");
    const label = partItem("Label: name_label");
    fireEvent.change(within(label).getByLabelText("Rotation"), { target: { value: "90" } });
    fireEvent.change(within(label).getByLabelText("Scale"), { target: { value: "1.5" } });
    expect(last().additions.find((a) => a.name === "name_label")).toMatchObject({ angle: 90, scaleX: 1.5, scaleY: 1.5 });

    open("Button: open_card_btn");
    const button = partItem("Button: open_card_btn");
    expect(within(button).getByLabelText("Rotation")).toBeInTheDocument();
    expect(within(button).queryByLabelText("Scale")).toBeNull();
  });

  it("a shape's settings: its size, corners or sides, colours, and the property it's shown by", () => {
    const { last } = setup(joinParts({ name: "t", object: {} }, addPart(addPart([], "rect"), "polygon")));
    open("Rectangle: rect");
    const rect = partItem("Rectangle: rect");
    fireEvent.change(within(rect).getByLabelText("Corner radius"), { target: { value: "3" } });
    fireEvent.change(within(rect).getByLabelText("Shown while"), { target: { value: "status_marked" } });
    expect(last().additions[0]).toMatchObject({ type: "rect", rx: 3, visible: false });
    expect(last().additions[0].tokenData.propDeps[0].dtoProperty).toBe("status_marked");

    open("Polygon: polygon");
    const polygon = partItem("Polygon: polygon");
    fireEvent.change(within(polygon).getByLabelText("Sides"), { target: { value: "3" } });
    expect(last().additions[1].points).toHaveLength(3);
    for (const label of ["Width", "Height", "Fill", "Outline", "Outline width"]) expect(within(polygon).getByLabelText(label)).toBeInTheDocument();
  });

  // A visibility switch (one Visible / GM only / Hidden choice in a game) can be on several parts.
  const sharedHp = () => {
    const parts = addPart(addPart(addPart([], "label"), "label"), "bar");
    return joinParts({ name: "t", object: {} }, [
      setPartGroup(parts[0], { group: "hp", label: "HP" }),
      setPartGroup(parts[1], { group: "hp", label: "HP" }),
      parts[2],
    ]);
  };
  const rename = (item, name) => {
    const input = within(item).getByLabelText("Name");
    fireEvent.change(input, { target: { value: name } });
    fireEvent.blur(input);
  };

  it("two parts on one switch: each its own box, opened on its own, the switch shown on both", () => {
    setup(sharedHp());
    const [first, second] = [partItem("Label: label"), partItem("Label: label2")];
    for (const item of [first, second]) expect(within(item).getByText("HP")).toBeInTheDocument();
    fireEvent.click(within(second).getByRole("button", { name: /settings/i }));
    expect(within(second).getByLabelText("Font size")).toBeInTheDocument();
    expect(within(first).queryByLabelText("Font size")).toBeNull();
  });

  it("a part's visibility switch: always shown, another switch, or a new one of its own", () => {
    const { last } = setup(sharedHp());
    open("Bar: bar");
    const select = () => within(partItem("Bar: bar")).getByLabelText("Visibility switch");
    expect([...select().options].map((o) => o.textContent)).toEqual(["Always shown", "HP (hp)", "Bar (bar)", "New switch…"]);
    fireEvent.change(select(), { target: { value: "hp" } });
    for (const a of last().additions.filter((x) => x.type === "rect")) expect(a.tokenData).toMatchObject({ maskGroup: "hp", label: "HP" });

    // Still open: the box is the same part.
    fireEvent.change(select(), { target: { value: "-none-" } });
    for (const a of last().additions.filter((x) => x.type === "rect")) expect(a.tokenData).not.toHaveProperty("maskGroup");
    expect(within(partItem("Bar: bar")).getByText("always shown")).toBeInTheDocument();
    // Still a bar, with its settings.
    expect(within(partItem("Bar: bar")).getByLabelText("Width")).toBeInTheDocument();

    fireEvent.change(select(), { target: { value: "-new-" } });
    expect(last().additions.find((x) => x.type === "rect").tokenData).toMatchObject({ maskGroup: "bar", label: "bar" });
  });

  it("a part's name is its own: renaming a new rectangle renames its addition, not its switch", () => {
    const { last } = setup(joinParts({ name: "t", object: {} }, addPart([], "rect")));
    open("Rectangle: rect");
    rename(partItem("Rectangle: rect"), "frame");
    expect(last().additions[0].name).toBe("frame");
    expect(last().additions[0].tokenData).toMatchObject({ maskGroup: "rect", label: "Rectangle" });
    // Still open after the rename.
    expect(within(partItem("Rectangle: frame")).getByLabelText("Name")).toHaveValue("frame");
  });

  it("a name is written when the field is left; one already used by another part isn't", () => {
    const { last, onChange } = setup(sharedHp());
    open("Label: label2");
    const input = within(partItem("Label: label2")).getByLabelText("Name");
    fireEvent.change(input, { target: { value: "hp_text" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(last().additions.map((a) => a.name)).toContain("hp_text");

    rename(partItem("Label: hp_text"), "label");
    expect(within(partItem("Label: hp_text")).getByText(/already used/)).toBeInTheDocument();
  });

  it("custom parts can be renamed and switched too", () => {
    const { last } = setup({ name: "t", object: {}, additions: [{ name: "odd", type: "triangle", tokenData: { maskGroup: "x", label: "X" } }] });
    open("Custom: odd");
    const item = partItem("Custom: odd");
    fireEvent.change(within(item).getByLabelText("Visibility switch"), { target: { value: "-none-" } });
    expect(last().additions[0].tokenData).toEqual({});
    rename(partItem("Custom: odd"), "even");
    expect(last().additions[0].name).toBe("even");
  });

  // Every rule a part has is editable, the ones its pattern made too: the file is read
  // again, so an edit the pattern can make keeps the part (with new settings), and one it
  // can't turns it into a custom part, nothing lost.
  it("a part's rules are all editable: a label's text rule reads another property, and it's still a label", () => {
    const { last } = setup();
    open("Label: name_label");
    const label = partItem("Label: name_label");
    expect(within(label).queryByText(/Locked rule/)).toBeNull();
    fireEvent.change(within(within(label).getByRole("group", { name: "Rule: text" })).getByLabelText("Property"), { target: { value: "nickname" } });
    expect(last().additions.find((a) => a.name === "name_label").tokenData.propDeps[0]).toMatchObject({ objectProperty: "text", dtoProperty: "nickname" });
    expect(within(partItem("Label: name_label")).getByRole("group", { name: "Rule: text" })).toBeInTheDocument();
  });

  it("a part's own rules are added after the ones it has", () => {
    const { last } = setup();
    open("Label: name_label");
    const label = partItem("Label: name_label");
    fireEvent.click(within(label).getByRole("button", { name: "Add rule" }));
    fireEvent.change(within(within(label).getByRole("group", { name: "Rule: opacity" })).getByLabelText("Property"), { target: { value: "alpha" } });
    const deps = last().additions.find((a) => a.name === "name_label").tokenData.propDeps;
    expect(deps.map((d) => d.objectProperty)).toEqual(["text", "opacity"]);
    expect(deps[1]).toMatchObject({ dtoProperty: "alpha", source: "card", type: "number" });
    // Still a label, still open, the rule shown.
    expect(within(partItem("Label: name_label")).getByRole("group", { name: "Rule: opacity" })).toBeInTheDocument();
  });

  it("a part of several additions: the rules all of them have, then each one's own (a bar's fill)", () => {
    const { last } = setup();
    open("Bar: hp_bar");
    const bar = () => partItem("Bar: hp_bar");
    fireEvent.click(within(bar()).getByRole("button", { name: /^Rules of hp_bar_fill/ }));
    const width = within(bar()).getByRole("group", { name: "Rule: width" });
    expect(within(width).getByLabelText("As")).toHaveValue("range");
    // An edit the bar doesn't make: read again, it's two rectangles now, each with its rules.
    fireEvent.change(within(width).getByLabelText("As"), { target: { value: "expression" } });
    expect(screen.queryByRole("group", { name: "Bar: hp_bar" })).toBeNull();
    open("Rectangle: hp_bar_fill");
    // Read again, the rule is what it now says (%hp%: Direct); it can be made anything.
    const rule = () => within(partItem("Rectangle: hp_bar_fill")).getByRole("group", { name: "Rule: width" });
    expect(within(rule()).getByLabelText("As")).toHaveValue("direct");
    fireEvent.change(within(rule()).getByLabelText("As"), { target: { value: "expression" } });
    fireEvent.change(within(rule()).getByLabelText("Expression"), { target: { value: "50" } });
    expect(last().additions.find((a) => a.name === "hp_bar_fill").tokenData.propDeps[0]).toMatchObject({ objectProperty: "width", expression: "50" });
  });

  it("a custom part's rules: the shared ones and each addition's own, all editable", () => {
    const shared = { objectProperty: "angle", type: "number", source: "card", dtoProperty: "facing" };
    const { last } = setup({ name: "t", object: {}, additions: [
      { name: "odd_a", type: "triangle", tokenData: { propDeps: [{ objectProperty: "fill", type: "string", source: "card", dtoProperty: "c" }, shared] } },
      { name: "odd_b", type: "triangle", tokenData: { propDeps: [shared] } },
    ] });
    open("Custom: odd");
    const item = partItem("Custom: odd");
    expect(within(item).queryByText(/some of its additions only/)).toBeNull();
    fireEvent.change(within(within(item).getByRole("group", { name: "Rule: angle" })).getByLabelText("Property"), { target: { value: "heading" } });
    expect(last().additions.map((a) => a.tokenData.propDeps.at(-1).dtoProperty)).toEqual(["heading", "heading"]);
    fireEvent.click(within(partItem("Custom: odd")).getByRole("button", { name: /^Rules of odd_a/ }));
    fireEvent.change(within(within(partItem("Custom: odd")).getByRole("group", { name: "Rule: fill" })).getByLabelText("Property"), { target: { value: "d" } });
    expect(last().additions[0].tokenData.propDeps.map((d) => d.dtoProperty)).toEqual(["d", "heading"]);
    expect(last().additions[1].tokenData.propDeps.map((d) => d.dtoProperty)).toEqual(["heading"]);
  });

  it("colours use the colour picker", () => {
    setup();
    open("Label: name_label");
    expect(within(partItem("Label: name_label")).getByRole("row", { name: /^Colour/ }).querySelector("[data-scope='color-picker']")).not.toBeNull();
  });

  it("a CSS colour the picker can't read stays a text field", () => {
    setup({ name: "t", object: {}, additions: [{
      name: "r_ring", type: "circle", radius: 50, stroke: "var(--accent)", strokeWidth: 3,
      tokenData: { anchor: "center", offsetX: 0, offsetY: 0, fitToToken: true, maskGroup: "r", label: "Faction ring" },
    }] });
    open("Ring: r_ring");
    expect(within(partItem("Ring: r_ring")).getByLabelText("Colour")).toHaveValue("var(--accent)");
  });

  it("an icon set's icons are cards; picking one shows its settings", () => {
    const { last } = setup();
    open("Status icons: status");
    const item = partItem("Status icons: status");
    const cards = within(item).getAllByRole("button", { name: /^Icon: / });
    expect(cards.map((c) => c.getAttribute("aria-label")).slice(0, 2)).toEqual(["Icon: Blinded", "Icon: Charmed"]);

    fireEvent.click(within(item).getByRole("button", { name: "Icon: Charmed" }));
    expect(within(item).getByRole("button", { name: "Icon: Charmed" })).toHaveAttribute("aria-pressed", "true");
    const details = within(item).getByRole("group", { name: "Icon settings: Charmed" });
    fireEvent.change(within(details).getByLabelText("Label"), { target: { value: "Enthralled" } });
    expect(last().assignableIcons.find((i) => i.id === "charmed").label).toBe("Enthralled");

    fireEvent.click(within(details).getByRole("button", { name: "Remove icon" }));
    expect(last().assignableIcons.some((i) => i.id === "charmed")).toBe(false);
    expect(last().assignableIcons.some((i) => i.id === "deafened")).toBe(true);
  });

  it("a button's click: open the card, or run an action by name", () => {
    const { last } = setup();
    open("Button: open_card_btn");
    const item = partItem("Button: open_card_btn");
    fireEvent.change(within(item).getByLabelText("On click"), { target: { value: "action" } });
    fireEvent.change(within(item).getByLabelText("Action name"), { target: { value: "dnd5e/attack" } });
    const button = last().additions.find((a) => a.name === "open_card_btn");
    expect(button.tokenData.actions.onClick).toEqual({ Action: "dnd5e/attack" });
  });

  it("a ring: its colour from a property is a rule of any kind, e.g. yes / no (infected)", () => {
    const def = { name: "t", object: {}, additions: [{
      name: "r_ring", type: "circle", radius: 50, stroke: "gold", strokeWidth: 3,
      tokenData: { anchor: "center", offsetX: 0, offsetY: 0, fitToToken: true, maskGroup: "r", label: "Faction ring" },
    }] };
    const { last } = setup(def);
    open("Ring: r_ring");
    const item = partItem("Ring: r_ring");
    fireEvent.click(within(item).getByRole("button", { name: "Add rule" }));
    const rule = () => within(item).getAllByRole("group").find((g) => /^Rule: /.test(g.getAttribute("aria-label")));
    fireEvent.change(within(rule()).getByLabelText("Set"), { target: { value: "stroke" } });
    fireEvent.change(within(rule()).getByLabelText("As"), { target: { value: "switch" } });
    fireEvent.change(within(rule()).getByLabelText("Property"), { target: { value: "infected" } });
    expect(last().additions[0].tokenData.propDeps).toEqual([
      expect.objectContaining({ objectProperty: "stroke", expression: expect.stringMatching(/^Enum\(%infected%, \{"true":/) }),
    ]);
  });
});
