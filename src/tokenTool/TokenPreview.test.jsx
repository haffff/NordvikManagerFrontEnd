import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, waitFor, screen } from "@testing-library/react";

vi.mock("../helpers/transport", () => import("./ToolTransport"));
vi.mock("../components/FabricTypesInitializer", () => ({}));
const session = vi.hoisted(() => ({
  place: vi.fn(async () => {}), refresh: vi.fn(async () => {}), setSelected: vi.fn(async () => {}),
  dispose: vi.fn(), token: () => null, manager: {},
  setArrange: vi.fn(), isArranging: () => false, tokenRect: () => ({ x: 100, y: 100, size: 50 }),
}));
vi.mock("./previewSession", () => ({ createPreviewSession: () => session }));
const overlays = vi.hoisted(() => ({ quickEdit: null, iconPicker: null }));
vi.mock("../components/BattleMap/Overlays/TokenQuickEditOverlay", () => ({ TokenQuickEditOverlay: (props) => { overlays.quickEdit = props; return null; } }));
vi.mock("../components/BattleMap/Overlays/TokenIconPickerOverlay", () => ({ TokenIconPickerOverlay: (props) => { overlays.iconPicker = props; return null; } }));

import { stubCanvasContext } from "./testCanvas";
import { TokenPreview } from "./TokenPreview";
import { PART_MIME } from "./dragDrop";
import { fireEvent, createEvent } from "@testing-library/react";
import ClientMediator from "../ClientMediator";

// The preview component wires the session to React props: the file and its size place
// the token again, values and the GM switch refresh it, "selected" toggles on-control parts.
describe("TokenPreview", () => {
  beforeEach(() => { stubCanvasContext(); vi.clearAllMocks(); overlays.quickEdit = overlays.iconPicker = null; });

  const definition = { name: "t", object: { type: "image" }, additions: [] };

  it("places the token file with its size and grid", async () => {
    render(<TokenPreview definition={definition} values={{ card: {} }} gridSize={70} size={2} imageKey="p.png" />);
    await waitFor(() => expect(session.place).toHaveBeenCalledWith(definition, { gridSize: 70, size: 2, imageKey: "p.png" }));
  });

  it("new sample values refresh it, without placing it again", async () => {
    const { rerender } = render(<TokenPreview definition={definition} values={{ card: { hp: "1" } }} />);
    await waitFor(() => expect(session.place).toHaveBeenCalledTimes(1));
    session.refresh.mockClear();
    rerender(<TokenPreview definition={definition} values={{ card: { hp: "2" } }} />);
    await waitFor(() => expect(session.refresh).toHaveBeenCalled());
    expect(session.place).toHaveBeenCalledTimes(1);
  });

  it("answers the token's property reads with the current values", async () => {
    const { rerender } = render(<TokenPreview definition={definition} values={{ card: { hp: "1" } }} />);
    rerender(<TokenPreview definition={definition} values={{ card: { hp: "9" } }} />);
    const props = await ClientMediator.sendCommandAsync("Properties", "GetByNames", { parentId: "preview-card", names: ["hp"] });
    expect(props[0].value).toBe("9");
  });

  // The game's own token overlays, on the preview's canvas, for the preview's map.
  it("shows the game's quick-edit and icon-picker overlays on its canvas", async () => {
    render(<TokenPreview definition={definition} values={{}} />);
    await waitFor(() => expect(overlays.quickEdit?.canvas).toBeTruthy());
    expect(overlays.quickEdit.battleMapId).toBe("preview-map");
    expect(overlays.iconPicker.battleMapId).toBe("preview-map");
    expect(overlays.iconPicker.canvas).toBe(overlays.quickEdit.canvas);
  });

  it("selected selects its token for the overlays; a new placement selects the new token", async () => {
    const seen = [];
    let token = { id: "preview-token", n: 1 };
    session.token = () => token;
    const { rerender } = render(<TokenPreview definition={definition} values={{}} />);
    ClientMediator.sendCommand("BattleMap", "SubscribeSelectionChanged", { contextId: "preview-map", name: "test", method: (e) => seen.push(e.selected) });
    rerender(<TokenPreview definition={definition} values={{}} selected />);
    await waitFor(() => expect(seen.at(-1)).toEqual([token]));

    token = { id: "preview-token", n: 2 };
    rerender(<TokenPreview definition={{ ...definition, name: "u" }} values={{}} selected />);
    await waitFor(() => expect(seen.at(-1)?.[0]?.n).toBe(2));

    rerender(<TokenPreview definition={{ ...definition, name: "u" }} values={{}} />);
    await waitFor(() => expect(seen.at(-1)).toEqual([]));
    session.token = () => null;
  });

  it("a property an overlay writes is handed on", async () => {
    const onProperty = vi.fn();
    render(<TokenPreview definition={definition} values={{}} onProperty={onProperty} />);
    const { ActiveTransportManager } = await import("./ToolTransport");
    ActiveTransportManager.Send({ command: "property_update", data: { name: "hp", value: "4", parentId: "preview-card" } });
    expect(onProperty).toHaveBeenCalledWith("card", "hp", "4");
  });

  it("selected is passed on", async () => {
    const { rerender } = render(<TokenPreview definition={definition} values={{}} />);
    rerender(<TokenPreview definition={definition} values={{}} selected />);
    await waitFor(() => expect(session.setSelected).toHaveBeenLastCalledWith(true));
  });

  it("arrange mode is passed on, and a finished drag reaches onMovePart", async () => {
    const onMovePart = vi.fn();
    const { rerender } = render(<TokenPreview definition={definition} values={{}} onMovePart={onMovePart} />);
    rerender(<TokenPreview definition={definition} values={{}} onMovePart={onMovePart} arrange />);
    await waitFor(() => expect(session.setArrange).toHaveBeenLastCalledWith(true, expect.any(Function)));
    session.setArrange.mock.lastCall[1]("hp_bar_fill", { anchor: "top", offsetX: 0, offsetY: -4 });
    expect(onMovePart).toHaveBeenCalledWith("hp_bar_fill", { anchor: "top", offsetX: 0, offsetY: -4 });
  });

  it("a palette entry dropped on the preview: the pattern and where on the token", () => {
    const onDropPattern = vi.fn();
    render(<TokenPreview definition={definition} values={{}} onDropPattern={onDropPattern} />);
    const area = screen.getByTestId("token-preview-drop");
    const dataTransfer = { types: [PART_MIME], getData: (type) => (type === PART_MIME ? "label" : ""), dropEffect: "" };
    const over = fireEvent.dragOver(area, { dataTransfer });
    expect(over).toBe(false); // default prevented: dropping is allowed
    // jsdom has no DragEvent, so the pointer position is put on the event itself.
    const drop = createEvent.drop(area, { dataTransfer });
    Object.defineProperties(drop, { clientX: { value: 125 }, clientY: { value: 160 } });
    fireEvent(area, drop);
    expect(onDropPattern).toHaveBeenCalledWith("label", { anchor: "bottom", offsetX: 0, offsetY: 10 });
  });

  it("other things dragged over it (files, text) aren't taken", () => {
    const onDropPattern = vi.fn();
    render(<TokenPreview definition={definition} values={{}} onDropPattern={onDropPattern} />);
    const area = screen.getByTestId("token-preview-drop");
    const dataTransfer = { types: ["Files"], getData: () => "" };
    expect(fireEvent.dragOver(area, { dataTransfer })).toBe(true);
    fireEvent.drop(area, { dataTransfer, clientX: 125, clientY: 160 });
    expect(onDropPattern).not.toHaveBeenCalled();
  });

  it("unmounting removes the token and the fake panels", () => {
    const { unmount } = render(<TokenPreview definition={definition} values={{}} />);
    unmount();
    expect(session.dispose).toHaveBeenCalled();
    expect(ClientMediator.sendCommand("Game", "GetGameId")).toBeUndefined();
  });
});
