import * as React from "react";
import { toolResources } from "./ToolTransport";

// The token editor's state, shared by its dock panels (Parts, Preview, Sample values,
// Token file, Picture) wherever the user docks them: the file as text and as parsed,
// the sample values the preview reads, the picture and how the preview is shown.

const PICTURE_KEY = "token-editor-picture";

export const BLANK_TOKEN = {
  $schema: "https://raw.githubusercontent.com/haffff/NordvikManager-Addons/refs/heads/main/schemas/token.json",
  name: "token", prefix: "token", size: 1, object: { type: "image" }, editableProps: [], assignableIcons: [], additions: [],
};

export const EXAMPLE_VALUES = { card: { hp: "7", maxhp: "12", character_name: "Aria", status_poisoned: "true" }, element: {} };

const parse = (text) => {
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "A token file is a JSON object." };
    return { value };
  } catch (err) {
    return { error: err.message };
  }
};

export function createEditorStore(initial) {
  let state = {
    text: JSON.stringify(initial, null, 2),
    definition: initial,
    error: null,
    values: EXAMPLE_VALUES,
    size: 1,
    gridSize: 70,
    isGM: true,
    selected: false,
    arrange: false,
    imageKey: null,
    log: [],
    notice: null,
  };
  const listeners = new Set();
  const set = (patch) => {
    state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
    listeners.forEach((l) => l());
  };

  const actions = {
    /** Text typed into the file box: drawn when it parses, the error shown when not. */
    applyText(text) {
      const { value, error } = parse(text);
      set({ text, error: error ?? null, ...(value ? { definition: value } : {}) });
    },
    /** A change made in the editor (parts, drag): the file text follows it. */
    edit(definition) {
      set({ definition, text: JSON.stringify(definition, null, 2), error: null });
    },
    setError: (error) => set({ error }),
    setNotice: (notice) => set({ notice }),
    setView: (patch) => set(patch),
    setValue(source, name, value) {
      set((s) => ({ values: { ...s.values, [source]: { ...(s.values[source] ?? {}), [name]: value } } }));
    },
    /** A picked file or a stamped PNG, kept in the browser as the token's picture. */
    setPicture(file) {
      if (!file) return;
      // A new key each time, so the preview loads the new picture.
      const key = `${PICTURE_KEY}-${Date.now()}`;
      toolResources.put(key, file);
      if (state.imageKey) toolResources.remove(state.imageKey);
      set((s) => ({ imageKey: key, values: { ...s.values, card: { ...s.values.card, tokenImage: key } } }));
    },
    addLog: (line) => set((s) => ({ log: [line, ...s.log].slice(0, 20) })),
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    actions,
  };
}

export const EditorContext = React.createContext(null);

/** [state, actions] of the editor the panel is in. */
export function useEditor() {
  const store = React.useContext(EditorContext);
  const state = React.useSyncExternalStore(store.subscribe, store.getState);
  return [state, store.actions];
}
