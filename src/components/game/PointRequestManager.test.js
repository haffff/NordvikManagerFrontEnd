import { describe, it, expect, vi } from "vitest";

vi.mock("../../ClientMediator", () => ({ default: { sendCommand: vi.fn() } }));
vi.mock("../../helpers/transport", () => ({ ActiveTransportManager: { Send: vi.fn() } }));
vi.mock("../uiComponents/base/Subscribable", () => ({ default: () => null }));

import { handlePointRequest } from "./PointRequestManager";

// The server's request_point (RequestPoint step): the player points on the battle map they
// are looking at, and the point — or { cancelled: true } — goes back as input_value.
describe("handlePointRequest", () => {
  const data = { message: "Where?", mapId: "m1", marker: { type: "circle", radius: 200 }, snap: "corner", range: null, highlight: true, showToOthers: true };
  const request = { inputToken: "tok", data };

  it("starts pointing on the current battle map and answers with the point on its map", () => {
    const send = vi.fn();
    let onDone;
    const setMode = vi.fn((battleMapId, req, done) => { onDone = done; });

    handlePointRequest(request, { current: () => ({ battleMapId: "bm", mapId: "m1" }), setMode, send });

    expect(setMode).toHaveBeenCalledWith("bm", data, expect.any(Function));
    onDone({ position: { x: 150, y: 100 } });
    expect(send).toHaveBeenCalledWith({ command: "input_value", inputToken: "tok", data: { x: 150, y: 100, mapId: "m1" } });
  });

  it("answers cancelled when the player cancels", () => {
    const send = vi.fn();
    handlePointRequest(request, { current: () => ({ battleMapId: "bm", mapId: "m1" }), setMode: (_, __, done) => done(null), send });

    expect(send).toHaveBeenCalledWith({ command: "input_value", inputToken: "tok", data: { cancelled: true } });
  });

  it("with two battle maps open, points on the one showing the asked map, not the one in focus", () => {
    const send = vi.fn();
    let onDone;
    const setMode = vi.fn((battleMapId, req, done) => { onDone = done; });
    handlePointRequest(request, {
      current: () => ({ battleMapId: "bm-a", mapId: "other" }),
      opened: () => [{ battleMapId: "bm-a", mapId: "other" }, { battleMapId: "bm-b", mapId: "m1" }],
      setMode, send,
    });

    expect(setMode).toHaveBeenCalledWith("bm-b", data, expect.any(Function));
    onDone({ position: { x: 5, y: 6 } });
    expect(send).toHaveBeenCalledWith({ command: "input_value", inputToken: "tok", data: { x: 5, y: 6, mapId: "m1" } });
  });

  it("prefers the battle map in focus when both show the asked map", () => {
    const setMode = vi.fn();
    handlePointRequest(request, {
      current: () => ({ battleMapId: "bm-b", mapId: "m1" }),
      opened: () => [{ battleMapId: "bm-a", mapId: "m1" }, { battleMapId: "bm-b", mapId: "m1" }],
      setMode, send: vi.fn(),
    });

    expect(setMode).toHaveBeenCalledWith("bm-b", data, expect.any(Function));
  });

  it("answers cancelled when no open battle map shows the asked map", () => {
    const send = vi.fn();
    const setMode = vi.fn();
    handlePointRequest(request, {
      current: () => ({ battleMapId: "bm", mapId: "other" }),
      opened: () => [{ battleMapId: "bm", mapId: "other" }, { battleMapId: "bm-2", mapId: "third" }],
      setMode, send,
    });

    expect(setMode).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith({ command: "input_value", inputToken: "tok", data: { cancelled: true } });
  });

  it("answers cancelled when no battle map is open", () => {
    const send = vi.fn();
    handlePointRequest(request, { current: () => undefined, setMode: vi.fn(), send });

    expect(send).toHaveBeenCalledWith({ command: "input_value", inputToken: "tok", data: { cancelled: true } });
  });
});
