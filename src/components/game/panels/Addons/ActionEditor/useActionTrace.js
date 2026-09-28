import * as React from "react";
import { ActiveTransportManager } from "../../../../../helpers/transport";
import UtilityHelper from "../../../../../helpers/UtilityHelper";

// Runs an action from the editor with tracing on, and collects the per-step results the
// server sends back ("action_trace" messages, only to the player who ran it). Unlike
// debug mode, this doesn't pause anything.

export const TRACE_COMMAND = "action_trace";

export function traceReducer(state, msg) {
  switch (msg.type) {
    case "start":
      return { traceId: msg.traceId, running: true, byStep: {}, result: null };
    case "event": {
      const d = msg.data ?? {};
      if (!state.traceId || d.traceId !== state.traceId) return state;
      if (d.status === "finished") {
        return { ...state, running: false, result: { state: d.state, error: d.error } };
      }
      if (!d.stepId) return state;
      return { ...state, byStep: { ...state.byStep, [d.stepId]: d } };
    }
    case "clear":
      return { traceId: null, running: false, byStep: {}, result: null };
    default:
      return state;
  }
}

export function useActionTrace() {
  const [state, dispatch] = React.useReducer(traceReducer, { traceId: null, running: false, byStep: {}, result: null });
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
      data: { Action: actionFullName, Args: args ?? {}, Trace: true, TraceId: traceId },
    });
  }, []);

  const clear = React.useCallback(() => dispatch({ type: "clear" }), []);

  return { ...state, run, clear };
}
