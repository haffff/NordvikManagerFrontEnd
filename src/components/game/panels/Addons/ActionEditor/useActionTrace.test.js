import { describe, it, expect, vi } from "vitest";

vi.mock("../../../../../helpers/transport", () => ({ ActiveTransportManager: {} }));
import { traceReducer } from "./useActionTrace";

const start = traceReducer({ traceId: null, byStep: {}, byPath: {} }, { type: "start", traceId: "t1" });
const event = (state, data) => traceReducer(state, { type: "event", data: { traceId: "t1", ...data } });

describe("traceReducer", () => {
  it("stores step results by id and by path", () => {
    const s = event(start, { stepPath: "0", stepId: "s1", status: "done" });
    expect(s.byStep.s1.status).toBe("done");
    expect(s.byPath["0"].status).toBe("done");
  });

  it("keeps results for steps saved without an id (matched by path, also inside blocks)", () => {
    const s = event(start, { stepPath: "2/Then/1", stepId: null, status: "failed", error: "boom" });
    expect(s.byPath["2/Then/1"].error).toBe("boom");
    expect(Object.keys(s.byStep)).toHaveLength(0);
  });

  it("finishes the run", () => {
    const s = event(start, { status: "finished", state: "Faulted", error: "x" });
    expect(s.running).toBe(false);
    expect(s.result).toEqual({ state: "Faulted", error: "x" });
  });

  it("ignores messages from other runs", () => {
    const s = traceReducer(start, { type: "event", data: { traceId: "other", stepPath: "0", status: "done" } });
    expect(s).toBe(start);
  });
});
