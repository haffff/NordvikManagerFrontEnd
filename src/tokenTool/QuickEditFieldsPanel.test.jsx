import * as React from "react";
import { vi, describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "../components/ui/provider";
import { QuickEditFieldsPanel } from "./QuickEditFieldsPanel";
import character from "./fixtures/token_character.json";

// The token's quick-edit fields (editableProps): what the gear next to a selected token
// lets a player change. Each field reads and writes one property; every change gives the
// whole token file back.

if (!window.PointerEvent) window.PointerEvent = class PointerEvent extends MouseEvent {};

function Harness({ initial, onChange }) {
  const [definition, setDefinition] = React.useState(initial);
  return <QuickEditFieldsPanel definition={definition} onChange={(next) => { onChange(next); setDefinition(next); }} />;
}
const setup = (definition = character) => {
  const onChange = vi.fn();
  render(<Provider><Harness initial={definition} onChange={onChange} /></Provider>);
  return { last: () => onChange.mock.lastCall[0] };
};
const field = (label) => screen.getByRole("group", { name: `Quick-edit field: ${label}` });

describe("QuickEditFieldsPanel", () => {
  it("lists the token's fields with their settings", () => {
    setup();
    const hp = field("HP");
    expect(within(hp).getByLabelText("Property")).toHaveValue("hp");
    expect(within(hp).getByLabelText("Read from")).toHaveValue("card");
    expect(within(hp).getByLabelText("Kind")).toHaveValue("text");
  });

  it("with none: says so", () => {
    setup({ name: "t", object: {}, additions: [] });
    expect(screen.getByText(/No quick-edit fields yet/)).toBeInTheDocument();
  });

  it("adds a field for a property the token reads (not the ones it already has)", async () => {
    const { last } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Add field" }));
    expect(screen.queryByRole("menuitem", { name: /^hp\b/ })).toBeNull();
    await userEvent.click(await screen.findByRole("menuitem", { name: /^maxhp\b/ }));
    expect(last().editableProps.at(-1)).toEqual({ name: "maxhp", dtoProperty: "maxhp", label: "maxhp", source: "card" });
  });

  it("a yes/no property becomes a checkbox field", async () => {
    const { last } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Add field" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /^status_poisoned\b/ }));
    expect(last().editableProps.at(-1)).toMatchObject({ dtoProperty: "status_poisoned", type: "boolean" });
  });

  it("adds an empty field with a free name", async () => {
    const { last } = setup({ name: "t", object: {}, additions: [], editableProps: [{ name: "field1", dtoProperty: "field1", source: "card" }] });
    await userEvent.click(screen.getByRole("button", { name: "Add field" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /^New field/ }));
    expect(last().editableProps.at(-1)).toEqual({ name: "field2", dtoProperty: "field2", label: "Field 2", source: "card" });
  });

  it("changes go into the file; the key follows the property while they're the same", () => {
    const { last } = setup();
    const hp = field("HP");
    fireEvent.change(within(hp).getByLabelText("Label"), { target: { value: "Hit points" } });
    expect(last().editableProps[0].label).toBe("Hit points");

    const renamed = field("Hit points");
    fireEvent.change(within(renamed).getByLabelText("Property"), { target: { value: "health" } });
    expect(last().editableProps[0]).toMatchObject({ name: "health", dtoProperty: "health" });

    fireEvent.change(within(renamed).getByLabelText("Kind"), { target: { value: "boolean" } });
    fireEvent.change(within(renamed).getByLabelText("Row group"), { target: { value: "hp" } });
    fireEvent.change(within(renamed).getByLabelText("Default"), { target: { value: "10" } });
    expect(last().editableProps[0]).toMatchObject({ type: "boolean", group: "hp", default: "10" });

    // Emptied optional settings are left out of the file.
    fireEvent.change(within(renamed).getByLabelText("Row group"), { target: { value: "" } });
    expect(last().editableProps[0]).not.toHaveProperty("group");
  });

  it("removes and reorders fields", () => {
    const def = { name: "t", object: {}, additions: [], editableProps: [
      { name: "a", dtoProperty: "a", label: "A", source: "card" },
      { name: "b", dtoProperty: "b", label: "B", source: "element" },
    ] };
    const { last } = setup(def);
    fireEvent.click(within(field("B")).getByRole("button", { name: "Move up" }));
    expect(last().editableProps.map((p) => p.name)).toEqual(["b", "a"]);
    fireEvent.click(within(field("A")).getByRole("button", { name: "Remove" }));
    expect(last().editableProps.map((p) => p.name)).toEqual(["b"]);
  });
});
