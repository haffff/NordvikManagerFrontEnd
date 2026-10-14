import * as React from "react";

// When moving / scaling an element on the battle map snaps it to the grid (with the
// grid shown and alignment on). Per operation: "always" (holding `key` skips it),
// "hold" (only while holding `key`) or "never". Per browser, like the dock modifier —
// held keys, not combos the KeyboardEventsManager fires on key-up.
const KEY = "nordvik.mapSnap";
const CHANGED_EVENT = "nordvik-map-snap-changed";

export const SNAP_OPERATIONS = ["move", "scale"];
export const SNAP_MODES = ["always", "hold", "never"];
export const SNAP_KEYS = ["Shift", "Ctrl", "Alt"];
export const DEFAULT_SNAP = Object.freeze({
  move: Object.freeze({ mode: "always", key: "Alt" }),
  scale: Object.freeze({ mode: "hold", key: "Ctrl" }),
});

const isValid = (setting) => SNAP_MODES.includes(setting?.mode) && SNAP_KEYS.includes(setting?.key);

export function getSnapSettings() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {};
  } catch {
    stored = {};
  }
  return Object.fromEntries(
    SNAP_OPERATIONS.map((op) => [op, isValid(stored[op]) ? { mode: stored[op].mode, key: stored[op].key } : { ...DEFAULT_SNAP[op] }])
  );
}

export function setSnapSetting(operation, setting) {
  if (!SNAP_OPERATIONS.includes(operation) || !isValid(setting)) return;
  const next = { ...getSnapSettings(), [operation]: { mode: setting.mode, key: setting.key } };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked — still applies to this page below */
  }
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: next }));
}

const isHeld = (key, keys) =>
  key === "Ctrl" ? !!(keys?.ctrlKey || keys?.metaKey) : key === "Alt" ? !!keys?.altKey : !!keys?.shiftKey;

/** Whether to snap now, given one operation's setting and the keys held ({ ctrlKey, altKey, ... }). */
export function shouldSnapNow(setting, keys) {
  if (setting?.mode === "always") return !isHeld(setting.key, keys);
  if (setting?.mode === "hold") return isHeld(setting.key, keys);
  return false;
}

// The current settings, following changes from the shortcuts panel (same page)
// and from other tabs (the storage event).
export function useSnapSettings() {
  const [settings, setSettings] = React.useState(getSnapSettings);

  React.useEffect(() => {
    const onChanged = () => setSettings(getSnapSettings());
    const onStorage = (ev) => {
      if (ev.key === KEY) setSettings(getSnapSettings());
    };
    window.addEventListener(CHANGED_EVENT, onChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGED_EVENT, onChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return settings;
}
