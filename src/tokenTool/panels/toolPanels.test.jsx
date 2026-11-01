import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Provider } from "../../components/ui/provider";
import { EditorContext, createEditorStore } from "../editorStore";
import { PictureView } from "./toolPanels";

// A token editor panel on its own, outside the dock, on a real editor store.
const renderPanel = (panel, definition) => {
  const store = createEditorStore(definition);
  render(<Provider><EditorContext.Provider value={store}>{panel}</EditorContext.Provider></Provider>);
  return store;
};

describe("PictureView", () => {
  it("Picture rules: the token picture's own rules (root tokenData.propDeps), none left when the last goes", () => {
    const store = renderPanel(<PictureView />, { name: "t", object: {}, additions: [] });
    fireEvent.click(screen.getByRole("button", { name: "Add rule" }));
    const rule = () => screen.getByRole("group", { name: "Rule: opacity" });
    fireEvent.change(within(rule()).getByLabelText("Property"), { target: { value: "alpha" } });
    expect(store.getState().definition.tokenData.propDeps).toEqual([{ objectProperty: "opacity", type: "number", source: "card", dtoProperty: "alpha" }]);
    fireEvent.click(within(rule()).getByRole("button", { name: "Remove rule" }));
    expect(store.getState().definition).not.toHaveProperty("tokenData");
  });

  it("the token's other settings are kept", () => {
    const store = renderPanel(<PictureView />, { name: "t", object: {}, additions: [], tokenData: { maxStatusIcons: 4 } });
    fireEvent.click(screen.getByRole("button", { name: "Add rule" }));
    expect(store.getState().definition.tokenData).toMatchObject({ maxStatusIcons: 4, propDeps: [{ objectProperty: "opacity" }] });
    fireEvent.click(screen.getByRole("button", { name: "Remove rule" }));
    expect(store.getState().definition.tokenData).toEqual({ maxStatusIcons: 4 });
  });
});
