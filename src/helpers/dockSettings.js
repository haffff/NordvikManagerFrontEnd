import * as React from "react";

// Which key must be held while dragging a panel for it to dock ("None" = always
// dock). Per browser, like the resource cache limit — not an account binding:
// it's a held modifier, not a combo the KeyboardEventsManager fires on key-up.
const KEY = "nordvik.dockModifier";
const CHANGED_EVENT = "nordvik-dock-modifier-changed";

export const DOCK_MODIFIERS = ["Shift", "Ctrl", "Alt", "None"];
export const DEFAULT_DOCK_MODIFIER = "Shift";

export function getDockModifier() {
  try {
    const raw = localStorage.getItem(KEY);
    return DOCK_MODIFIERS.includes(raw) ? raw : DEFAULT_DOCK_MODIFIER;
  } catch {
    return DEFAULT_DOCK_MODIFIER;
  }
}

export function setDockModifier(modifier) {
  if (!DOCK_MODIFIERS.includes(modifier)) return;
  try {
    localStorage.setItem(KEY, modifier);
  } catch {
    /* storage blocked — still applies to this page below */
  }
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: modifier }));
}

// The current modifier, following changes from the shortcuts panel (same page)
// and from other tabs (the storage event).
export function useDockModifier() {
  const [modifier, setModifier] = React.useState(getDockModifier);

  React.useEffect(() => {
    const onChanged = (ev) =>
      setModifier(DOCK_MODIFIERS.includes(ev.detail) ? ev.detail : getDockModifier());
    const onStorage = (ev) => {
      if (ev.key === KEY) setModifier(getDockModifier());
    };
    window.addEventListener(CHANGED_EVENT, onChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGED_EVENT, onChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return modifier;
}
