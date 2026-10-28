import * as React from "react";
import UtilityHelper from "../../../../../helpers/UtilityHelper";
import { withIds, updateById, removeById, duplicateById, insertInto, moveWithin } from "./stepTree";

// Editing state for one action: the action's fields plus its steps, with an "unsaved"
// flag and undo/redo. Consecutive edits with the same `key` (typing in one field) are
// merged into a single undo entry.

const HISTORY_LIMIT = 50;

const parseSteps = (content) => {
  let steps;
  try { steps = typeof content === "string" ? JSON.parse(content || "[]") : content; } catch { steps = []; }
  if (!Array.isArray(steps)) steps = [];
  return withIds(steps);
};

const snapshotKey = (action, steps) =>
  JSON.stringify({ ...action, content: undefined, steps });

export const initialDraftState = {
  action: null,
  steps: [],
  saved: null,   // snapshotKey of the last loaded/saved state
  past: [],
  future: [],
  lastKey: null,
};

export function draftReducer(state, msg) {
  switch (msg.type) {
    case "load": {
      const steps = parseSteps(msg.action?.content);
      const action = msg.action ? { ...msg.action } : null;
      return { ...initialDraftState, action, steps, saved: snapshotKey(action, steps) };
    }
    case "edit": {
      if (!state.action) return state;
      const next = msg.apply({ action: state.action, steps: state.steps });
      if (next.action === state.action && next.steps === state.steps) return state;
      const merge = msg.key && msg.key === state.lastKey;
      const past = merge
        ? state.past
        : [...state.past, { action: state.action, steps: state.steps }].slice(-HISTORY_LIMIT);
      return { ...state, ...next, past, future: [], lastKey: msg.key ?? null };
    }
    case "undo": {
      if (!state.past.length) return state;
      const prev = state.past[state.past.length - 1];
      return {
        ...state, ...prev,
        past: state.past.slice(0, -1),
        future: [{ action: state.action, steps: state.steps }, ...state.future],
        lastKey: null,
      };
    }
    case "redo": {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return {
        ...state, ...next,
        past: [...state.past, { action: state.action, steps: state.steps }],
        future: rest,
        lastKey: null,
      };
    }
    case "saved":
      return { ...state, saved: snapshotKey(state.action, state.steps), lastKey: null };
    case "breakMerge":
      return { ...state, lastKey: null };
    default:
      return state;
  }
}

export const isDirty = (state) =>
  !!state.action && state.saved !== snapshotKey(state.action, state.steps);

export const toPayload = (state) => ({ ...state.action, content: JSON.stringify(state.steps) });

export function useActionDraft() {
  const [state, dispatch] = React.useReducer(draftReducer, initialDraftState);

  const api = React.useMemo(() => {
    const edit = (apply, key) => dispatch({ type: "edit", apply, key });
    return {
      load: (action) => dispatch({ type: "load", action }),
      undo: () => dispatch({ type: "undo" }),
      redo: () => dispatch({ type: "redo" }),
      markSaved: () => dispatch({ type: "saved" }),
      // Ends the current merge group, e.g. when a field loses focus.
      breakMerge: () => dispatch({ type: "breakMerge" }),
      updateAction: (patch, key) => edit((d) => ({ ...d, action: { ...d.action, ...patch } }), key),
      setSteps: (fn, key) => edit((d) => ({ ...d, steps: fn(d.steps) }), key),
      // Any step, also one inside a block (If's Then / Else, ForEach's Do).
      updateStep: (id, fn, key) => edit((d) => ({ ...d, steps: updateById(d.steps, id, fn) }), key),
    };
  }, []);

  return {
    ...api,
    action: state.action,
    steps: state.steps,
    dirty: isDirty(state),
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    payload: () => toPayload(state),
    state,
  };
}

// Step list operations used by the editor (pure, so they're easy to test). They reach steps
// inside blocks too; `container` is where to insert: null for the action's own list,
// { parentId, block } for a block of a step.
export const stepOps = {
  insertAt: (steps, index, step, container = null) => insertInto(steps, container, index, step),
  remove: (steps, id) => removeById(steps, id),
  duplicate: (steps, id) => duplicateById(steps, id),
  move: (steps, fromId, toId) => moveWithin(steps, fromId, toId),
  newStep: (type) => ({ id: UtilityHelper.GenerateUUID(), Type: type, Data: {} }),
};
