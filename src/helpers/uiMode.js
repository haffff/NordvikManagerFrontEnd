import * as React from "react";

// Desktop (the dock) or mobile (full-screen tabs with a bottom bar) game UI.
// The override is per browser, like the dock modifier: Auto picks mobile on a
// small touch screen. A new key, so frozen older player builds sharing this
// origin's storage are unaffected.
const KEY = "nordvik.uiMode";
const CHANGED_EVENT = "nordvik-ui-mode-changed";

export const UI_MODES = ["auto", "desktop", "mobile"];
const DEFAULT_OVERRIDE = "auto";

// Below this, in either orientation, a touch screen is a phone.
const PHONE_MAX_SIDE = 768;

export function getUiModeOverride() {
  try {
    const raw = localStorage.getItem(KEY);
    return UI_MODES.includes(raw) ? raw : DEFAULT_OVERRIDE;
  } catch {
    return DEFAULT_OVERRIDE;
  }
}

export function setUiModeOverride(mode) {
  if (!UI_MODES.includes(mode)) return;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* storage blocked — still reported to this page below */
  }
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: mode }));
}

// The stored override, following changes from the settings panel and other tabs.
export function useUiModeOverride() {
  const [mode, setMode] = React.useState(getUiModeOverride);

  React.useEffect(() => {
    const onChanged = (ev) => setMode(UI_MODES.includes(ev.detail) ? ev.detail : getUiModeOverride());
    const onStorage = (ev) => {
      if (ev.key === KEY) setMode(getUiModeOverride());
    };
    window.addEventListener(CHANGED_EVENT, onChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGED_EVENT, onChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return mode;
}

// The screen's shorter side, so rotating a phone doesn't change the answer.
export function isSmallTouchScreen(win = typeof window !== "undefined" ? window : undefined) {
  if (typeof win?.matchMedia !== "function") return false;
  const coarse = win.matchMedia("(pointer: coarse)").matches;
  const shortSide = Math.min(win.screen?.width ?? Infinity, win.screen?.height ?? Infinity);
  return coarse && shortSide < PHONE_MAX_SIDE;
}

export function resolveUiMode(override, smallTouchScreen) {
  if (override === "mobile" || override === "desktop") return override;
  return smallTouchScreen ? "mobile" : "desktop";
}

export function getUiMode() {
  return resolveUiMode(getUiModeOverride(), isSmallTouchScreen());
}

// The mode the running game picked when it opened. It stays for the session (a
// change applies on reload): switching shells would unmount every panel.
// Non-React code (DockableHelper) reads it.
let activeUiMode = "desktop";

export function setActiveUiMode(mode) {
  activeUiMode = mode === "mobile" ? "mobile" : "desktop";
}

export const isMobileUi = () => activeUiMode === "mobile";
