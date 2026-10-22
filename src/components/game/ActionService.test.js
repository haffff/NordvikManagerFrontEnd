import { vi, describe, it, expect, beforeEach } from "vitest";

const send = vi.fn();
vi.mock("../../helpers/transport", () => ({ ActiveTransportManager: { Send: (...a) => send(...a) } }));
vi.mock("../../ClientMediator", () => ({ default: { sendCommand: vi.fn() } }));

import ClientMediator from "../../ClientMediator";
import { ActionService } from "./ActionService";

const sentArgs = () => send.mock.calls.at(-1)[0].data.Args;

// Every action a player runs knows the map they are looking at, so "the tokens" or "the
// turn order" need no map id from the action's author.
describe("ActionService.Run", () => {
  beforeEach(() => {
    send.mockClear();
    ClientMediator.sendCommand.mockImplementation((panel, command) =>
      panel === "Game" && command === "GetCurrentBattleMap" ? { battleMapId: "bm-1", mapId: "map-1" } : undefined);
  });

  it("adds the battle map view and map the player is looking at", () => {
    ActionService.Run({ name: "x/y", args: { a: 1 } });

    expect(sentArgs()).toEqual({ battleMapId: "bm-1", mapId: "map-1", a: 1 });
  });

  it("keeps the caller's own map, e.g. from a map tool click", () => {
    ActionService.Run({ name: "x/y", args: { battleMapId: "bm-2", mapId: "map-2" } });

    expect(sentArgs()).toEqual({ battleMapId: "bm-2", mapId: "map-2" });
  });

  it("adds nothing when no battle map is open", () => {
    ClientMediator.sendCommand.mockReturnValue(undefined);

    ActionService.Run({ name: "x/y" });

    expect(sentArgs()).toEqual({});
  });
});
