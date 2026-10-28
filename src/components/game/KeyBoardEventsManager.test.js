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

describe("isValidBindingValue", () => {
  it("accepts a bare panel.command", () => {
    expect(isValidBindingValue("battlemap.CopyElements")).toBe(true);
  });

  it("accepts a command with a --flag=value argument tail", () => {
    expect(isValidBindingValue("Playlist.PlaySound --resourceId=abc-123")).toBe(true);
  });

  it("accepts the empty-string tombstone", () => {
    expect(isValidBindingValue("")).toBe(true);
  });

  it("rejects a value with no dot", () => {
    expect(isValidBindingValue("save")).toBe(false);
  });

  it("rejects a dangling dot", () => {
    expect(isValidBindingValue("game.")).toBe(false);
    expect(isValidBindingValue(".save")).toBe(false);
  });

  it("rejects a value longer than the server limit", () => {
    const tooLong = "game.Do --value=" + "x".repeat(MAX_BINDING_VALUE_LENGTH);
    expect(isValidBindingValue(tooLong)).toBe(false);
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
