import { describe, it, expect, vi } from "vitest";

vi.mock("../../ClientMediator", () => ({ default: { sendCommand: vi.fn() } }));
vi.mock("../../helpers/transport", () => ({ ActiveTransportManager: { Send: vi.fn() } }));
vi.mock("../uiComponents/base/Subscribable", () => ({ default: () => null }));

import { handleTargetRequest } from "./TargetPickingManager";

// The server's request_targets (RequestTargets step): the player picks on the battle map
// they are looking at, and the picked ids — or { cancelled: true } — go back as input_value.
describe("handleTargetRequest", () => {
  const request = { inputToken: "tok", data: { message: "Bless whom?", min: 1, max: 3, candidates: ["a", "b"] } };

  it("starts picking on the current battle map and answers with the picked ids", () => {
    const send = vi.fn();
    let onDone;
    const setMode = vi.fn((battleMapId, req, done) => { onDone = done; });

    handleTargetRequest(request, { current: () => ({ battleMapId: "bm" }), setMode, send });

    expect(setMode).toHaveBeenCalledWith("bm", { message: "Bless whom?", min: 1, max: 3, candidates: ["a", "b"] }, expect.any(Function));
    onDone({ picked: ["b", "a"] });
    expect(send).toHaveBeenCalledWith({ command: "input_value", inputToken: "tok", data: ["b", "a"] });
  });

  it("answers cancelled when the player cancels", () => {
    const send = vi.fn();
    handleTargetRequest(request, { current: () => ({ battleMapId: "bm" }), setMode: (_, __, done) => done(null), send });

    expect(send).toHaveBeenCalledWith({ command: "input_value", inputToken: "tok", data: { cancelled: true } });
  });

  it("answers cancelled when no battle map is open", () => {
    const send = vi.fn();
    handleTargetRequest(request, { current: () => undefined, setMode: vi.fn(), send });

    expect(send).toHaveBeenCalledWith({ command: "input_value", inputToken: "tok", data: { cancelled: true } });
  });
});
