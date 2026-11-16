import { vi } from "vitest";

vi.mock("../../ClientMediator", () => ({
  default: {
    sendCommand: vi.fn(),
    sendCommandAsync: vi.fn(),
    sendCommandWaitForRegisterAsync: vi.fn(),
  },
}));
vi.mock("../../helpers/CentralWebHelper", () => ({ default: { getAsync: vi.fn(), postAsync: vi.fn() } }));
vi.mock("../../helpers/WebHelper", () => ({ default: { getAsync: vi.fn(), postAsync: vi.fn() } }));

import ClientMediator from "../../ClientMediator";
import KeyboardEventsManager, {
  isValidBindingValue,
  mergeShortcuts,
  MAX_BINDING_VALUE_LENGTH,
  DefaultShortCuts,
} from "./KeyBoardEventsManager";

beforeEach(() => vi.clearAllMocks());

describe("Ctrl+A", () => {
  const key = (target, extra = {}) => ({
    key: "a", ctrlKey: true, shiftKey: false, altKey: false, target, preventDefault: vi.fn(), ...extra,
  });
  const inside = (className) => {
    const parent = document.createElement("div");
    parent.className = className;
    const child = document.createElement("div");
    parent.appendChild(child);
    return child;
  };
  const fired = () => ClientMediator.sendCommandAsync.mock.calls.filter(([, command]) => command === "SelectAll");
  const settle = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => ClientMediator.sendCommandWaitForRegisterAsync.mockResolvedValue("map-1"));

  it("selects all on the map at key down, and not again at key up", async () => {
    const mgr = new KeyboardEventsManager();
    const down = key(inside("nm_battleMap"));

    mgr.HandleKeyboardEventDown(down);
    mgr.HandleKeyboardEventUp(key(inside("nm_battleMap")));
    await settle();

    expect(down.preventDefault).toHaveBeenCalled();
    expect(fired()).toEqual([["battlemap", "SelectAll", { contextId: "map-1" }]]);
  });

  it("selects once while the key is held down", async () => {
    const mgr = new KeyboardEventsManager();

    mgr.HandleKeyboardEventDown(key(inside("nm_battleMap")));
    mgr.HandleKeyboardEventDown(key(inside("nm_battleMap"), { repeat: true }));
    await settle();

    expect(fired()).toHaveLength(1);
  });

  it("stays the browser's in any other panel", async () => {
    const mgr = new KeyboardEventsManager();
    const down = key(inside("nm_chat"));

    mgr.HandleKeyboardEventDown(down);
    mgr.HandleKeyboardEventUp(key(inside("nm_chat")));
    await settle();

    expect(down.preventDefault).not.toHaveBeenCalled();
    expect(fired()).toEqual([]);
  });

  it("stays the browser's in a text box on the map", async () => {
    const mgr = new KeyboardEventsManager();
    const box = document.createElement("input");
    inside("nm_battleMap").appendChild(box);
    const down = key(box);

    mgr.HandleKeyboardEventDown(down);
    await settle();

    expect(down.preventDefault).not.toHaveBeenCalled();
    expect(fired()).toEqual([]);
  });
});

describe("isValidBindingValue", () => {
  // A panel.command, optionally with a --flag=value tail; "" is the tombstone for a removed default.
  it.each([
    ["a bare panel.command", "battlemap.CopyElements", true],
    ["a command with a --flag=value argument tail", "Playlist.PlaySound --resourceId=abc-123", true],
    ["the empty-string tombstone", "", true],
    ["a value with no dot", "save", false],
    ["a dangling dot (end)", "game.", false],
    ["a dangling dot (start)", ".save", false],
    ["a value longer than the server limit", "game.Do --value=" + "x".repeat(MAX_BINDING_VALUE_LENGTH), false],
  ])("%s → %s", (_name, value, valid) => {
    expect(isValidBindingValue(value)).toBe(valid);
  });

});

describe("mergeShortcuts", () => {
  it("returns the defaults untouched when there are no saved bindings", () => {
    expect(mergeShortcuts(null)).toEqual(DefaultShortCuts);
  });

  it("parses an argument tail into an args object on the merged entry", () => {
    const merged = mergeShortcuts({ "Ctrl+Shift+S": "Playlist.PlaySound --resourceId=abc-123" });
    expect(merged["Ctrl+Shift+S"]).toEqual({
      panel: "Playlist",
      command: "PlaySound",
      args: { resourceId: "abc-123" },
    });
  });

  it("leaves args empty for a bare command", () => {
    const merged = mergeShortcuts({ "Ctrl+J": "game.Jump" });
    expect(merged["Ctrl+J"]).toEqual({ panel: "game", command: "Jump", args: {} });
  });

  it("honours the empty-string tombstone by unbinding a default key", () => {
    const merged = mergeShortcuts({ "Ctrl+C": "" });
    expect(merged["Ctrl+C"]).toBeUndefined();
  });

  it("drops malformed saved bindings but keeps valid ones", () => {
    const merged = mergeShortcuts({ "Ctrl+K": "not a command", "Ctrl+L": "game.Look" });
    expect(merged["Ctrl+K"]).toBeUndefined();
    expect(merged["Ctrl+L"]).toEqual({ panel: "game", command: "Look", args: {} });
  });
});

describe("FireKeyboardEvent", () => {
  it("forwards parsed arguments into the dispatched payload", async () => {
    const mgr = new KeyboardEventsManager();
    mgr.ShortCuts = {
      "Ctrl+Shift+S": { panel: "Playlist", command: "PlaySound", args: { resourceId: "abc-123" } },
    };

    await mgr.FireKeyboardEvent("Ctrl+Shift+S");

    expect(ClientMediator.sendCommandAsync).toHaveBeenCalledWith(
      "Playlist",
      "PlaySound",
      { resourceId: "abc-123" }
    );
  });

  it("still dispatches an argless binding with an empty payload", async () => {
    const mgr = new KeyboardEventsManager();
    mgr.ShortCuts = { "Ctrl+J": { panel: "game", command: "Jump", args: {} } };

    await mgr.FireKeyboardEvent("Ctrl+J");

    expect(ClientMediator.sendCommandAsync).toHaveBeenCalledWith("game", "Jump", {});
  });

  it("layers contextId on top of parsed args for battlemap commands", async () => {
    ClientMediator.sendCommandWaitForRegisterAsync.mockResolvedValue("ctx-1");
    const mgr = new KeyboardEventsManager();
    mgr.ShortCuts = {
      "Ctrl+Shift+X": { panel: "battlemap", command: "DoThing", args: { foo: "bar" } },
    };

    await mgr.FireKeyboardEvent("Ctrl+Shift+X");

    expect(ClientMediator.sendCommandAsync).toHaveBeenCalledWith(
      "battlemap",
      "DoThing",
      { foo: "bar", contextId: "ctx-1" }
    );
  });
});
