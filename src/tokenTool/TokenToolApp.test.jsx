import { vi, describe, it, expect } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "../components/ui/provider";

vi.mock("../helpers/transport", () => import("./ToolTransport"));
const preview = vi.hoisted(() => ({ props: null }));
vi.mock("./TokenPreview", () => ({ TokenPreview: (props) => { preview.props = props; return <div data-testid="preview" />; } }));
const stamper = vi.hoisted(() => ({ props: null }));
vi.mock("./stamper/Stamper", () => ({ Stamper: (props) => { stamper.props = props; return null; } }));
// The game's JSON editor (jsoneditor) stands in as a text box that, like the real one,
// reads its value only when it mounts and reports only text that parses.
const jsonEditor = vi.hoisted(() => ({ props: null, mounts: 0 }));
vi.mock("../components/uiComponents/JsonEditor", async () => {
  const React = await import("react");
  const JsonEditor = (props) => {
    jsonEditor.props = props;
    React.useEffect(() => { jsonEditor.mounts += 1; }, []);
    return (
      <textarea aria-label="Token file JSON" defaultValue={JSON.stringify(props.value)}
        onChange={(e) => { try { props.onChange(JSON.parse(e.target.value)); } catch { /* the editor shows it */ } }} />
    );
  };
  return { JsonEditor, default: JsonEditor };
});

import TokenToolApp from "./TokenToolApp";

// jsdom has no PointerEvent; the game's Switch (Zag) makes one when its input loses focus.
if (!window.PointerEvent) window.PointerEvent = class PointerEvent extends MouseEvent {};
import { toolResources } from "./ToolTransport";

// The token editor page: a token file (the dnd5e character as the example), sample
// values for the properties it reads, and the preview showing them.
const renderApp = () => render(<Provider><TokenToolApp /></Provider>);
// A dock tab is picked by pressing on it.
const openTab = async (title) => {
  const tab = (await screen.findAllByText(title, { exact: true }))[0];
  fireEvent.mouseDown(tab.parentElement);
  fireEvent.mouseUp(window);
};

describe("TokenToolApp", () => {
  it("starts with the example token and an input per property it reads", () => {
    renderApp();
    expect(preview.props.definition.name).toBe("token");
    expect(screen.getByLabelText(/^hp/)).toHaveValue(7);
    expect(screen.getByLabelText(/^status_poisoned/)).toBeChecked();
  });

  it("a changed sample value reaches the preview", () => {
    renderApp();
    fireEvent.change(screen.getByLabelText(/^hp/), { target: { value: "3" } });
    expect(preview.props.values.card.hp).toBe("3");
  });

  it("the Token file panel is the game's JSON editor (as in an element's Direct Edit): its edits are drawn", () => {
    renderApp();
    expect(jsonEditor.props.value.name).toBe("token");
    const mounts = jsonEditor.mounts;
    const json = screen.getByLabelText("Token file JSON");
    fireEvent.change(json, { target: { value: '{"name":"t","object":{},"additions":[{"name":"x","type":"text","tokenData":{"propDeps":[{"dtoProperty":"ac","objectProperty":"text","type":"string","source":"card"}]}}]}' } });
    expect(preview.props.definition.name).toBe("t");
    expect(screen.getByLabelText(/^ac/)).toBeInTheDocument();
    // Its own edits don't open it again (that would lose the place being typed at).
    expect(jsonEditor.mounts).toBe(mounts);

    // Text that doesn't parse (shown by the editor itself) changes nothing.
    fireEvent.change(json, { target: { value: '{"name": ' } });
    expect(preview.props.definition.name).toBe("t");
  });

  it("a change made elsewhere (a part added) opens the JSON editor again on the new file", async () => {
    renderApp();
    const mounts = jsonEditor.mounts;
    fireEvent.click(screen.getByRole("button", { name: "New blank token" }));
    await vi.waitFor(() => expect(jsonEditor.mounts).toBe(mounts + 1));
    expect(jsonEditor.props.value.additions).toEqual([]);
  });

  it("only a JSON object is a token file: an emptied editor changes nothing", () => {
    renderApp();
    act(() => jsonEditor.props.onChange(null));
    act(() => jsonEditor.props.onChange([1]));
    expect(preview.props.definition.name).toBe("token");
  });

  it("a value typed into the game's quick-edit overlay becomes the sample value", () => {
    renderApp();
    act(() => preview.props.onProperty("card", "hp", "2"));
    expect(screen.getByLabelText(/^hp/)).toHaveValue(2);
    expect(preview.props.values.card.hp).toBe("2");
  });

  it("a chosen picture is kept in the browser and shown as the token's image", () => {
    renderApp();
    const file = new File(["png"], "portrait.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Choose picture"), { target: { files: [file] } });
    const key = preview.props.imageKey;
    expect(toolResources.get(key)).toBe(file);
    expect(preview.props.values.card.tokenImage).toBe(key);
  });

  it("a stamped picture becomes the token's image", () => {
    renderApp();
    const png = new Blob([], { type: "image/png" });
    act(() => stamper.props.onUse(png, "portrait-token.png"));
    expect(toolResources.get(preview.props.imageKey)).toBe(png);
    expect(preview.props.values.card.tokenImage).toBe(preview.props.imageKey);
  });

  it("the + menu offers the one-click parts in categories; a click adds one at its usual place", async () => {
    renderApp();
    const before = preview.props.definition.additions.length;
    await userEvent.click(screen.getByRole("button", { name: "Add part" }));
    for (const name of ["Bar", "Status icons", "Label", "Button", "Ring"]) {
      expect(await screen.findByRole("menuitem", { name: new RegExp(`^${name}`) })).toHaveAttribute("draggable", "true");
    }
    const menu = screen.getByRole("menu");
    for (const category of ["Values", "Status", "Interaction", "Shapes"]) expect(within(menu).getByText(category)).toBeInTheDocument();
    for (const name of ["Rectangle", "Circle", "Polygon"]) {
      expect(within(menu).getByRole("menuitem", { name: new RegExp(`^${name}`) })).toHaveAttribute("draggable", "true");
    }
    await userEvent.click(screen.getByRole("menuitem", { name: /^Bar/ }));
    const added = preview.props.definition.additions.slice(before);
    expect(added.map((a) => a.name)).toEqual(["bar_bg", "bar_fill"]);
    // Its usual place (bottom, 4) and the next one (16) are the example's HP bar and name.
    expect(added[0].tokenData).toMatchObject({ anchor: "bottom", offsetY: 28 });
    expect(JSON.parse(screen.getByLabelText("Token file JSON").value).additions).toHaveLength(before + 2);
  });

  it("a menu entry dragged onto the preview is added where it was dropped", async () => {
    renderApp();
    const dataTransfer = { setData: vi.fn(), effectAllowed: "" };
    await userEvent.click(screen.getByRole("button", { name: "Add part" }));
    fireEvent.dragStart(await screen.findByRole("menuitem", { name: /^Label/ }), { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith("application/x-nordvik-token-part", "label");

    act(() => preview.props.onDropPattern("label", { anchor: "top", offsetX: 0, offsetY: -20 }));
    expect(preview.props.definition.additions.at(-1).tokenData).toMatchObject({ anchor: "top", offsetY: -20, maskGroup: "label" });
  });

  it("arrange: parts can be dragged (on-selection parts shown), and a drag is written into the file", async () => {
    renderApp();
    await userEvent.click(screen.getByRole("checkbox", { name: "Arrange parts" }));
    expect([preview.props.arrange, preview.props.selected]).toEqual([true, true]);

    act(() => preview.props.onMovePart("name_label", { anchor: "top", offsetX: 0, offsetY: -24 }));
    const label = preview.props.definition.additions.find((a) => a.name === "name_label");
    expect(label.tokenData).toMatchObject({ anchor: "top", offsetX: 0, offsetY: -24 });
    const saved = JSON.parse(screen.getByLabelText("Token file JSON").value).additions.find((a) => a.name === "name_label");
    expect(saved.tokenData.anchor).toBe("top");
  });

  it("the part list edits the file: removing the conditions", () => {
    renderApp();
    const conditions = screen.getByRole("group", { name: "Status icons: status" });
    fireEvent.click(within(conditions).getByRole("button", { name: "Remove" }));
    expect(preview.props.definition.additions.some((a) => a.name.startsWith("status_"))).toBe(false);
    expect(JSON.parse(screen.getByLabelText("Token file JSON").value).assignableIcons).toEqual([]);
  });

  it("the file is checked against the token schema; problems are listed with where they are", () => {
    renderApp();
    expect(screen.queryByRole("list", { name: "Schema problems" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Token file JSON"), { target: { value: '{"name":"t","object":{},"additions":[{"name":"bar","tokenData":{"anchor":"middle"}}]}' } });
    const problems = screen.getByRole("list", { name: "Schema problems" });
    expect(problems).toHaveTextContent(/bar.*anchor.*allowed values/);
    expect(preview.props.definition.name).toBe("t"); // still drawn
  });

  // Opened from a game (Edit on a token resource): the game's file comes in, and
  // "Save to game" hands the edited file back (helpers/tokenEditorLink.js).
  const fromGame = (save = vi.fn(async () => {})) => {
    const link = { save, dispose: vi.fn(), open: null };
    const connect = vi.fn(({ onOpen }) => { link.open = onOpen; return link; });
    render(<Provider><TokenToolApp connect={connect} /></Provider>);
    return link;
  };

  it("opened from a game: shows the game's file, and Save to game sends the edited file back", async () => {
    const link = fromGame();
    expect(screen.queryByRole("button", { name: "Save to game" })).toBeNull(); // no file yet
    act(() => link.open({ name: "token_hero.json", text: '{"name":"hero","object":{},"additions":[]}' }));
    expect(preview.props.definition.name).toBe("hero");
    expect(screen.getByText(/token_hero\.json/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Token file JSON"), { target: { value: '{"name":"hero2","object":{},"additions":[]}' } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save to game" })));
    expect(JSON.parse(link.save.mock.lastCall[0]).name).toBe("hero2");
    expect(screen.getByText("Saved to the game.")).toBeInTheDocument();
  });

  it("a save the game refused shows why", async () => {
    const link = fromGame(vi.fn(async () => { throw new Error("No Edit permission"); }));
    act(() => link.open({ name: "t.json", text: '{"name":"t","object":{},"additions":[]}' }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save to game" })));
    expect(screen.getByText(/No Edit permission/)).toBeInTheDocument();
  });

  it("not opened from a game: no Save to game", () => {
    render(<Provider><TokenToolApp connect={() => null} /></Provider>);
    expect(screen.queryByRole("button", { name: "Save to game" })).toBeNull();
  });

  it("a new blank token: no parts, the schema linked", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "New blank token" }));
    expect(preview.props.definition.additions).toEqual([]);
    expect(JSON.parse(screen.getByLabelText("Token file JSON").value).$schema).toMatch(/schemas\/token\.json$/);
    expect(screen.getByText(/No parts yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "dnd5e example" }));
    expect(preview.props.definition.additions.length).toBeGreaterThan(10);
  });

  it("downloads the file as token_<name>.json, and copies it", async () => {
    renderApp();
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const clicked = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () { clicked.push(this.download); });
    fireEvent.change(screen.getByLabelText("Token file JSON"), { target: { value: '{"name":"Goblin Boss","object":{},"additions":[]}' } });
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(clicked).toEqual(["token_goblin_boss.json"]);
    click.mockRestore();

    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith(JSON.stringify({ name: "Goblin Boss", object: {}, additions: [] }, null, 2));
  });

  it("an opened file that doesn't parse: the error shows, and it can't be downloaded", async () => {
    renderApp();
    // jsdom's File has no text(), a browser's does.
    const file = Object.assign(new File(["{"], "token_bad.json"), { text: async () => "{" });
    fireEvent.change(screen.getByLabelText("Open token file"), { target: { files: [file] } });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toBeDisabled();
  });

  it("the editor is a dock of the game's panels: Parts, Quick-edit fields, Visibility switches, Preview, Sample values, Token file, Picture", async () => {
    const { container } = renderApp();
    expect(container.querySelector(".nm_dock")).not.toBeNull();
    // The dock sets tab titles on the next frame.
    for (const title of ["Parts", "Quick-edit fields", "Visibility switches", "Preview", "Sample values", "Token file", "Picture"]) {
      expect((await screen.findAllByText(title, { exact: true })).length).toBeGreaterThan(0);
    }
    // Each panel is a game panel body.
    expect(container.querySelectorAll(".nm_basePanel").length).toBe(7);
  });

  it("Quick-edit fields is a tab next to Parts (the left column stays one panel)", async () => {
    renderApp();
    expect(screen.getByRole("button", { name: "Add part" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add field" })).toBeNull(); // in the tab behind
    await openTab("Quick-edit fields");
    expect(screen.getByRole("button", { name: "Add field" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add part" })).toBeNull();
  });

  it("Visibility switches (a tab on the left): a setting tried there reaches the preview", async () => {
    renderApp();
    await openTab("Visibility switches");
    const hp = screen.getByRole("group", { name: "Visibility switch: HP Bar" });
    fireEvent.click(within(within(hp).getByRole("group", { name: "On the map" })).getByRole("button", { name: "Hidden" }));
    expect(preview.props.values.map).toMatchObject({ mask_hp_enabled: "false", mask_hp_gmonly: "false" });
  });

  it("a part put on a switch in Parts is listed under that switch in Visibility switches", async () => {
    renderApp();
    await openTab("Parts");
    const label = screen.getByRole("group", { name: "Label: name_label" });
    fireEvent.click(within(label).getByRole("button", { name: /settings/i }));
    fireEvent.change(within(label).getByLabelText("Visibility switch"), { target: { value: "hp" } });
    expect(preview.props.definition.additions.filter((a) => a.tokenData?.maskGroup === "hp")).toHaveLength(3);

    await openTab("Visibility switches");
    expect(within(screen.getByRole("group", { name: "Visibility switch: HP Bar" })).getByText("Label: name_label")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Visibility switch: Name Label" })).toBeNull();
  });

  it("a rule added in Parts reaches the preview, and Sample values offers its property", async () => {
    renderApp();
    await openTab("Parts");
    const label = screen.getByRole("group", { name: "Label: name_label" });
    fireEvent.click(within(label).getByRole("button", { name: /settings/i }));
    fireEvent.click(within(label).getByRole("button", { name: "Add rule" }));
    fireEvent.change(within(within(label).getByRole("group", { name: "Rule: opacity" })).getByLabelText("Property"), { target: { value: "alpha" } });
    const deps = preview.props.definition.additions.find((a) => a.name === "name_label").tokenData.propDeps;
    expect(deps.at(-1)).toMatchObject({ objectProperty: "opacity", dtoProperty: "alpha" });
    await openTab("Sample values");
    expect(document.getElementById("sample-card-alpha")).toBeVisible();
  });

  it("a quick-edit field added in its panel goes into the file and the preview", async () => {
    renderApp();
    await openTab("Quick-edit fields");
    await userEvent.click(screen.getByRole("button", { name: "Add field" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /^maxhp\b/ }));
    expect(preview.props.definition.editableProps.map((p) => p.name)).toEqual(["hp", "maxhp"]);
    await vi.waitFor(() => expect(jsonEditor.props.value.editableProps).toHaveLength(2));
  });

  it("a closed panel comes back with Reset layout, and the work is kept", async () => {
    renderApp();
    fireEvent.change(screen.getByLabelText("Token file JSON"), { target: { value: '{"name":"kept","object":{},"additions":[]}' } });
    const partsTab = (await screen.findAllByText("Parts", { exact: true }))[0];
    fireEvent.click(within(partsTab.parentElement).getByTitle("Close Tab"));
    await vi.waitFor(() => expect(screen.queryByRole("button", { name: "Add part" })).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Reset layout" }));
    expect(await screen.findByRole("button", { name: "Add part" })).toBeInTheDocument();
    expect(screen.getByLabelText("Token file JSON")).toHaveValue('{"name":"kept","object":{},"additions":[]}');
  });

  it("the panels share one file: an edit in one shows in the others", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "New blank token" }));
    expect(screen.getByText(/No parts yet/)).toBeInTheDocument();
    expect(JSON.parse(screen.getByLabelText("Token file JSON").value).additions).toEqual([]);
    expect(screen.getByText("This token reads no properties.")).toBeInTheDocument();
  });

  it("size, grid and the two switches go to the preview", async () => {
    renderApp();
    fireEvent.change(screen.getByLabelText("Size in squares"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Grid size in pixels"), { target: { value: "50" } });
    await userEvent.click(screen.getByRole("checkbox", { name: "View as GM" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Selected" }));
    expect([preview.props.size, preview.props.gridSize, preview.props.isGM, preview.props.selected]).toEqual([2, 50, false, true]);
  });
});
