import * as React from "react";

// The soundboard sounds this browser plays right now (resourceId -> Audio). PlaybackManager
// keeps it; the Soundboard panel lights up their tiles and follows their progress.
const playing = new Map();
const listeners = new Set();
let snapshot = new Set();

const changed = () => {
  snapshot = new Set(playing.keys());
  listeners.forEach((listener) => listener());
};

export const playingSounds = {
  started(resourceId, audio) {
    playing.set(resourceId, audio);
    changed();
  },
  ended(resourceId) {
    if (playing.delete(resourceId)) changed();
  },
  clear() {
    if (playing.size === 0) return;
    playing.clear();
    changed();
  },
  get: (resourceId) => playing.get(resourceId),
  ids: () => [...playing.keys()],
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** The ids of the sounds playing now (a Set); re-renders when one starts or ends. */
export const usePlayingSounds = () =>
  React.useSyncExternalStore(playingSounds.subscribe, () => snapshot);
