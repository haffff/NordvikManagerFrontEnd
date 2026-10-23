import * as React from "react";
import { ActiveTransportManager } from "../../../../../helpers/transport";
import UtilityHelper from "../../../../../helpers/UtilityHelper";
import ClientMediator from "../../../../../ClientMediator";

// Runs an action from the editor with tracing on, and collects the per-step results the
// server sends back ("action_trace" messages, only to the player who ran it). Unlike
// debug mode, this doesn't pause anything.

export const TRACE_COMMAND = "action_trace";

export function traceReducer(state, msg) {
  switch (msg.type) {
    case "start":
      return { traceId: msg.traceId, running: true, byStep: {}, byPath: {}, result: null };
    case "event": {
      const d = msg.data ?? {};
      if (!state.traceId || d.traceId !== state.traceId) return state;
      if (d.status === "finished") {
        return { ...state, running: false, result: { state: d.state, error: d.error } };
      }
      // Steps saved without an id (hand-written actions) are matched by their path
      // ("3", or "3/Then/1" inside a block); the editor saves before running, so the
      // server's paths match the list.
      const byPath = d.stepPath != null ? { ...state.byPath, [d.stepPath]: d } : state.byPath;
      const byStep = d.stepId ? { ...state.byStep, [d.stepId]: d } : state.byStep;
      return { ...state, byStep, byPath };
    }
    case "clear":
      return { traceId: null, running: false, byStep: {}, byPath: {}, result: null };
    default:
      return state;
  }
}

// The execute_action data. Like ActionService.Run, the battle map view and map the player is
// looking at go along (else the server uses the game's first view); the caller's own win.
export function traceRunData(actionFullName, args, traceId, where) {
  const current = where ? { battleMapId: where.battleMapId, mapId: where.mapId } : {};
  return { Action: actionFullName, Args: { ...current, ...(args ?? {}) }, Trace: true, TraceId: traceId };
}

export function useActionTrace() {
  const [state, dispatch] = React.useReducer(traceReducer, { traceId: null, running: false, byStep: {}, byPath: {}, result: null });
  const subscriptionName = React.useMemo(() => `ActionTrace-${UtilityHelper.GenerateUUID()}`, []);

  React.useEffect(() => {
    ActiveTransportManager.Subscribe(subscriptionName, (message) => {
      if (message?.command === TRACE_COMMAND) dispatch({ type: "event", data: message.data });
    });
    return () => ActiveTransportManager.Unsubscribe(subscriptionName);
  }, [subscriptionName]);

  const run = React.useCallback((actionFullName, args) => {
    const traceId = UtilityHelper.GenerateUUID();
    dispatch({ type: "start", traceId });
    ActiveTransportManager.Send({
      command: "execute_action",
      data: traceRunData(actionFullName, args, traceId, ClientMediator.sendCommand("Game", "GetCurrentBattleMap")),
    });
  }, []);

  const clear = React.useCallback(() => dispatch({ type: "clear" }), []);

  return { ...state, run, clear };
}
