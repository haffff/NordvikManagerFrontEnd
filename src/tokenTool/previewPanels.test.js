import { describe, it, expect, afterEach, vi } from "vitest";
import ClientMediator from "../ClientMediator";

vi.mock("../helpers/transport", () => import("./ToolTransport"));

import { ActiveTransportManager } from "../helpers/transport";
import { registerPreviewPanels, PREVIEW_IDS } from "./previewPanels";

// What TokenManager asks the game for, answered by the token editor: sample values, the
// map's grid, who is looking — and a log line for whatever a click on a part would do.
describe("registerPreviewPanels", () => {
  let dispose;
  afterEach(() => dispose?.());

  const setup = (over = {}) => {
    const log = [];
    const state = { values: { card: { hp: "7" }, element: { mask_hp_enabled: "false" } }, gridSize: 70, isGM: true, ...over };
    const changes = [];
    const panels = registerPreviewPanels({ get: () => state, onEvent: (line) => log.push(line), onProperty: (...change) => changes.push(change) });
    dispose = panels.dispose;
    return { state, log, panels, changes };
  };

  it("answers sample values for the token's card and the token itself", async () => {
    setup();
    expect(await ClientMediator.sendCommandAsync("Properties", "GetByNames", { parentId: PREVIEW_IDS.card, names: ["hp", "maxhp"] }))
      .toEqual([{ id: `${PREVIEW_IDS.card}-hp`, parentId: PREVIEW_IDS.card, name: "hp", value: "7", entityName: "CardModel" }]);
    expect((await ClientMediator.sendCommandAsync("Properties", "GetByNames", { parentId: PREVIEW_IDS.token, names: ["mask_hp_enabled"] }))[0].value).toBe("false");
    expect(await ClientMediator.sendCommandAsync("Properties", "GetByNames", { parentId: "someone-else", names: ["hp"] })).toEqual([]);
  });

  it("reads the state each time it's asked", async () => {
    const { state } = setup();
    state.values.card.hp = "12";
    expect((await ClientMediator.sendCommandAsync("Properties", "GetByNames", { parentId: PREVIEW_IDS.card, names: ["hp"] }))[0].value).toBe("12");
  });

  // The game's token overlays (quick edit, icon picker) follow the map's selection.
  it("tells the token overlays when the preview's token is selected", () => {
    const { panels } = setup();
    const seen = [];
    const subscribed = ClientMediator.sendCommand("BattleMap", "SubscribeSelectionChanged", {
      contextId: PREVIEW_IDS.map, name: "overlay", method: (e) => seen.push(e.selected),
    });
    expect(subscribed).toBeTruthy(); // else the overlay waits for a BattleMap forever
    const token = { id: PREVIEW_IDS.token };
    panels.select(token);
    panels.select(null);
    expect(seen).toEqual([[token], []]);

    ClientMediator.sendCommand("BattleMap", "UnSubscribeSelectionChanged", { contextId: PREVIEW_IDS.map, name: "overlay" });
    panels.select(token);
    expect(seen).toHaveLength(2);
  });

  // What the overlays write (an HP typed in, a condition picked) becomes the sample value.
  it("properties the overlays write become sample values", () => {
    const { changes } = setup();
    ActiveTransportManager.Send({ command: "property_update", data: { id: `${PREVIEW_IDS.card}-hp`, name: "hp", value: "3", parentId: PREVIEW_IDS.card, entityName: "CardModel" } });
    ActiveTransportManager.Send({ command: "property_add", data: { name: "status_prone", value: true, parentId: PREVIEW_IDS.card, entityName: "CardModel" } });
    ActiveTransportManager.Send({ command: "property_add", data: { name: "x", value: "1", parentId: "someone-else" } });
    ActiveTransportManager.Send({ command: "element_update", data: {} });
    expect(changes).toEqual([["card", "hp", "3"], ["card", "status_prone", "true"]]);
  });

  it("the map, the game and who is looking", () => {
    const { state } = setup();
    expect(ClientMediator.sendCommand("BattleMap", "GetSelectedMap", {})).toEqual({ id: PREVIEW_IDS.map, gridSize: 70 });
    expect(ClientMediator.sendCommand("Game", "GetGameId")).toBe(PREVIEW_IDS.game);
    expect(ClientMediator.sendCommand("Game", "GetCanEditGame")).toBe(true);
    state.isGM = false;
    expect(ClientMediator.sendCommand("Game", "GetIsGM")).toBe(false);
  });

  it("a click on a part logs what it would do", () => {
    const { log } = setup();
    ClientMediator.sendCommand("Action", "Run", { name: "dnd5e/attack", args: { cardId: "c", tokenId: "t" } });
    ClientMediator.sendCommand("Game", "CreateNewPanel", { type: "CardPanel", props: { id: "c" } });
    expect(log).toEqual([
      'Runs the action dnd5e/attack {"cardId":"c","tokenId":"t"}',
      'Game.CreateNewPanel {"type":"CardPanel","props":{"id":"c"}}',
    ]);
  });

  it("dispose takes the panels away again", () => {
    setup();
    dispose();
    dispose = null;
    expect(ClientMediator.sendCommand("Game", "GetGameId")).toBeUndefined();
  });
});
