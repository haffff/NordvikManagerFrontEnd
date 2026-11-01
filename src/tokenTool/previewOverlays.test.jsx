import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { fabric } from "fabric";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../helpers/transport", () => import("./ToolTransport"));

import { Provider } from "../components/ui/provider";
import { TokenQuickEditOverlay } from "../components/BattleMap/Overlays/TokenQuickEditOverlay";
import { TokenIconPickerOverlay } from "../components/BattleMap/Overlays/TokenIconPickerOverlay";
import { createPreviewSession } from "./previewSession";
import { registerPreviewPanels, PREVIEW_IDS } from "./previewPanels";
import { stubCanvasContext, fakeCanvas } from "./testCanvas";
import character from "./fixtures/token_character.json";

// The game's own token overlays on the editor's preview, with nothing mocked between
// them: the token the preview places, the fake game panels and the real overlays. The
// dnd5e character has an editable HP and its conditions in the icon picker.

const enlivenAsRect = async (object) => new fabric.Rect({ ...object, type: "rect", fill: "#888" });

describe("the game's token overlays on the preview", () => {
  let panels, session, canvas, state, changes;

  beforeEach(async () => {
    stubCanvasContext();
    state = { values: { card: { hp: "7", maxhp: "12" }, element: {} }, gridSize: 50, isGM: true };
    changes = [];
    panels = registerPreviewPanels({
      get: () => state, onEvent: () => {},
      onProperty: (source, name, value) => {
        changes.push([source, name, value]);
        state.values[source][name] = value;
      },
    });
    canvas = fakeCanvas();
    canvas.wrapperEl = document.createElement("div"); // where Fabric puts its canvases
    document.body.appendChild(canvas.wrapperEl);
    session = createPreviewSession({ canvas, enliven: enlivenAsRect });
    await session.place(character, { gridSize: 50 });
  });

  afterEach(() => {
    session.dispose();
    panels.dispose();
    canvas.wrapperEl.remove();
    vi.restoreAllMocks();
  });

  const renderOverlays = () => render(
    <Provider>
      <TokenQuickEditOverlay battleMapId={PREVIEW_IDS.map} canvas={canvas} />
      <TokenIconPickerOverlay battleMapId={PREVIEW_IDS.map} canvas={canvas} />
    </Provider>
  );

  it("quick edit: the token's HP shows, and a changed HP becomes the sample value", async () => {
    renderOverlays();
    expect(screen.queryByRole("button", { name: "Token settings" })).toBeNull();
    act(() => panels.select(session.token()));

    await userEvent.click(await screen.findByRole("button", { name: "Token settings" }));
    const hp = await screen.findByRole("textbox", { name: "HP" });
    await vi.waitFor(() => expect(hp).toHaveValue("7"));
    fireEvent.change(hp, { target: { value: "3" } });
    fireEvent.blur(hp);
    expect(changes).toContainEqual(["card", "hp", "3"]);

    act(() => panels.select(null));
    expect(screen.queryByRole("button", { name: "Token settings" })).toBeNull();
  });

  it("icon picker: opened from quick edit, picking a condition sets its property", async () => {
    renderOverlays();
    act(() => panels.select(session.token()));
    await userEvent.click(await screen.findByRole("button", { name: "Token settings" }));
    await userEvent.click(await screen.findByRole("button", { name: /icons/i }));

    const blinded = await screen.findByRole("button", { name: /Blinded/ });
    await userEvent.click(blinded);
    await vi.waitFor(() => expect(changes).toContainEqual(["card", "status_blinded", "true"]));
  });
});
