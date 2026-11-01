import { describe, it, expect, beforeEach } from "vitest";
import { ActiveWebHelper, ActiveTransportManager, toolResources } from "./ToolTransport";

// The token editor runs with no game: in its build, src/helpers/transport.js resolves to
// this file, and pictures and SVGs come from files the user picked, kept in the browser.
describe("ToolTransport", () => {
  beforeEach(() => toolResources.clear());

  it("resource URLs look like the backend's, so the app's image loader asks for the blob", () => {
    expect(ActiveWebHelper.getResourceString(null, "portrait.png")).toBe("/api/Materials/Resource?key=portrait.png");
    expect(ActiveWebHelper.getResourceString("0f8fad5b-d9cb-469f-a165-70867728950e")).toBe("/api/Materials/Resource?id=0f8fad5b-d9cb-469f-a165-70867728950e");
  });

  it("answers a picked picture as a blob, and nothing for an unknown one (the bundled default then shows)", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    toolResources.put("portrait.png", blob);
    expect(await ActiveWebHelper.getResourceBlobAsync(null, "portrait.png")).toBe(blob);
    expect(await ActiveWebHelper.getResourceBlobAsync(null, "emptyTokenImage")).toBeNull();
  });

  it("answers an SVG part's src as text", async () => {
    toolResources.put("icon.svg", "<svg/>");
    expect(await ActiveWebHelper.getMaterialAsync(null, "text/plain", "icon.svg")).toBe("<svg/>");
    expect(await ActiveWebHelper.getMaterialAsync("icon.svg", "text/plain")).toBe("<svg/>");
  });

  it("has no server to ask", async () => {
    await expect(ActiveWebHelper.getAsync("anything")).rejects.toThrow(/token editor/);
    await expect(ActiveWebHelper.postAsync("materials/BuildToken", {})).rejects.toThrow(/token editor/);
  });

  it("server commands go nowhere, but can be watched", () => {
    const seen = [];
    const stop = ActiveTransportManager.watch((c) => seen.push(c));
    expect(ActiveTransportManager.Send({ command: "element_update", data: {} })).toBe(true);
    stop();
    ActiveTransportManager.Send({ command: "ignored" });
    expect(seen).toEqual([{ command: "element_update", data: {} }]);
    expect(() => { ActiveTransportManager.Subscribe("x", () => {}); ActiveTransportManager.Unsubscribe("x"); }).not.toThrow();
  });
});
