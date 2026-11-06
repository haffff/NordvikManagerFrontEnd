import * as React from "react";
import { vi, describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Provider } from "../components/ui/provider";
import { VisibilitySwitchesPanel } from "./VisibilitySwitchesPanel";
import character from "./fixtures/token_character.json";

// The token's visibility switches (tokenData.maskGroup + label): each is one Visible /
// GM only / Hidden setting in a game's map and token settings, for every part on it. A
// part picks its switch in Parts; here a switch is named, given a key, tried out in the
// preview, or removed (its parts are then always shown).

function Harness({ initial, onChange, onValue, values = { map: {}, element: {} } }) {
  const [definition, setDefinition] = React.useState(initial);
  return (
    <VisibilitySwitchesPanel
      definition={definition} values={values} onValue={onValue}
      onChange={(next) => { onChange(next); setDefinition(next); }}
    />
  );
}
const setup = (definition = character, values) => {
  const onChange = vi.fn();
  const onValue = vi.fn();
  render(<Provider><Harness initial={definition} onChange={onChange} onValue={onValue} values={values} /></Provider>);
  return { last: () => onChange.mock.lastCall[0], onValue, onChange };
};
const card = (label) => screen.getByRole("group", { name: `Visibility switch: ${label}` });
const additionsOn = (file, key) => file.additions.filter((a) => a.tokenData?.maskGroup === key);

describe("VisibilitySwitchesPanel", () => {
  it("lists the token's switches with their key and the parts on them", () => {
    setup();
    for (const label of ["HP Bar", "Name Label", "Open Card Button", "Counter icons", "Conditions"]) expect(card(label)).toBeInTheDocument();
    const hp = card("HP Bar");
    expect(within(hp).getByLabelText("Key")).toHaveValue("hp");
    expect(within(hp).getByText("Bar: hp_bar")).toBeInTheDocument();
  });

  it("parts aren't moved here: that's each part's setting in Parts", () => {
    setup();
    expect(screen.queryByLabelText(/^Move /)).toBeNull();
    expect(screen.getAllByText(/in Parts/).length).toBeGreaterThan(0);
  });

  it("a new name is written on every part on the switch (the game shows the first)", () => {
    const { last } = setup();
    fireEvent.change(within(card("HP Bar")).getByLabelText("Shown as"), { target: { value: "Health" } });
    expect(additionsOn(last(), "hp").map((a) => a.tokenData.label)).toEqual(["Health", "Health"]);
  });

  it("a new key renames the switch; a key that isn't letters, digits and _, or is taken, isn't used", () => {
    const { last } = setup();
    const key = within(card("HP Bar")).getByLabelText("Key");
    fireEvent.change(key, { target: { value: "health" } });
    expect(additionsOn(last(), "health")).toHaveLength(2);

    fireEvent.change(key, { target: { value: "h p" } });
    expect(within(card("HP Bar")).getByText(/letters, digits and _/)).toBeInTheDocument();
    fireEvent.change(key, { target: { value: "name" } });
    expect(within(card("HP Bar")).getByText(/already used/)).toBeInTheDocument();
    expect(additionsOn(last(), "health")).toHaveLength(2);
    fireEvent.change(key, { target: { value: "health" } });
    expect(within(card("HP Bar")).queryByText(/already used|letters, digits/)).toBeNull();
  });

  it("warns that games keep a switch's settings under its key", () => {
    setup();
    expect(within(card("HP Bar")).getByText(/settings games already made/)).toBeInTheDocument();
  });

  it("tries a setting out: the map's, or the token's own (as map and token settings set them)", () => {
    const { onValue } = setup();
    const hp = card("HP Bar");
    fireEvent.click(within(within(hp).getByRole("group", { name: "On the map" })).getByRole("button", { name: "Hidden" }));
    expect(onValue).toHaveBeenCalledWith("map", "mask_hp_enabled", "false");
    expect(onValue).toHaveBeenCalledWith("map", "mask_hp_gmonly", "false");
    fireEvent.click(within(within(hp).getByRole("group", { name: "On the token" })).getByRole("button", { name: "GM only" }));
    expect(onValue).toHaveBeenCalledWith("element", "mask_hp_enabled", "true");
    expect(onValue).toHaveBeenCalledWith("element", "mask_hp_gmonly", "true");
  });

  it("shows the setting the sample values have", () => {
    setup(character, { map: { mask_hp_enabled: "false", mask_hp_gmonly: "false" }, element: {} });
    const onMap = within(card("HP Bar")).getByRole("group", { name: "On the map" });
    expect(within(onMap).getByRole("button", { name: "Hidden" })).toHaveAttribute("aria-pressed", "true");
  });

  it("removing a switch, once confirmed, leaves its parts always shown", () => {
    const { last, onChange } = setup();
    fireEvent.click(within(card("Name Label")).getByRole("button", { name: "Remove switch" }));
    expect(within(card("Name Label")).getByText(/always shown/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(within(card("Name Label")).getByRole("button", { name: "Remove" }));
    const label = last().additions.find((a) => a.name === "name_label");
    expect(label.tokenData).not.toHaveProperty("maskGroup");
    expect(label.tokenData).not.toHaveProperty("label");
    expect(screen.queryByRole("group", { name: "Visibility switch: Name Label" })).toBeNull();
  });

  it("removing can be cancelled", () => {
    const { onChange } = setup();
    fireEvent.click(within(card("HP Bar")).getByRole("button", { name: "Remove switch" }));
    fireEvent.click(within(card("HP Bar")).getByRole("button", { name: "Cancel" }));
    expect(within(card("HP Bar")).queryByRole("button", { name: "Remove" })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("after a removal, a half-typed key doesn't pass to the card that takes its place", () => {
    setup();
    // Open Card Button is the third card; removing Name Label (the second) shifts it up.
    fireEvent.change(within(card("Open Card Button")).getByLabelText("Key"), { target: { value: "bad key" } });
    expect(within(card("Open Card Button")).getByText(/letters, digits/)).toBeInTheDocument();
    fireEvent.click(within(card("Name Label")).getByRole("button", { name: "Remove switch" }));
    fireEvent.click(within(card("Name Label")).getByRole("button", { name: "Remove" }));
    expect(within(card("Counter icons")).getByLabelText("Key")).toHaveValue("counters");
    expect(within(card("Open Card Button")).getByLabelText("Key")).toHaveValue("opencard");
    expect(screen.queryByText(/letters, digits/)).toBeNull();
  });

  it("with no switches: says where a part gets one", () => {
    setup({ name: "t", object: {}, additions: [] });
    expect(screen.getByText(/No visibility switches yet/)).toBeInTheDocument();
  });
});
