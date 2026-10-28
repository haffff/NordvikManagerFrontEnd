// Styles for card pages that opt in (template property app_styles = "true").
//
// A card runs in a sandboxed frame, a document of its own, so neither the app's
// CSS nor the game's custom stylesheets reach it. An opted-in card gets:
//   1. before its own CSS: the current --nordvik-* values, plus the app's own
//      nm_ classes (panel.css, card-base.css);
//   2. after its own CSS: the game's custom stylesheets as applied in the app
//      (already sanitised), so a theme wins there as it does in the app.
// CardPanel puts both in the page and sends APP_STYLES when either changes.
import panelCss from "../stylesheets/panel.css?raw";
import cardBaseCss from "../stylesheets/card-base.css?raw";
import { themeColors } from "./themeColors";

// Declared on :root in index.css (the rest only exist as fallbacks in themeColors).
const ROOT_VARIABLES = Object.freeze({
  "text-color": "#f0f0f0",
  "secondary-color": "#0b0b0b",
  "background-color": "rgb(30,30,30)",
  "selection-color": "var(--nordvik-accent)",
  "item-color": "rgb(70, 70, 70)",
  "button-color": "rgb(23, 23, 23)",
  "button-border-color": "rgb(206, 206, 206)",
  "button-color-hover": "rgb(52, 52, 52)",
  "button-color-active": "rgb(127, 127, 127)",
});

const THEME_COLOR = /^var\(--nordvik-([\w-]+),\s*(.+)\)$/;

/** Every --nordvik-* variable the app uses, with the app's own value. */
export function nordvikVariables() {
  const variables = new Map(Object.entries(ROOT_VARIABLES));
  for (const value of Object.values(themeColors)) {
    const match = THEME_COLOR.exec(value);
    if (match && !variables.has(match[1])) variables.set(match[1], match[2].trim());
  }
  return [...variables].map(([name, fallback]) => ({ name, fallback }));
}

const appRoot = () =>
  (typeof document !== "undefined" && (document.querySelector("#NordvikManagerMain") ?? document.documentElement)) || null;

/** A :root block with each variable's current value in the app (a theme's included). */
export function appVariablesCss(element = appRoot()) {
  const computed = element ? getComputedStyle(element) : null;
  const lines = nordvikVariables().map(({ name, fallback }) => {
    const value = computed?.getPropertyValue(`--nordvik-${name}`).trim();
    return `  --nordvik-${name}: ${value || fallback};`;
  });
  const font = (typeof document !== "undefined" && document.body && getComputedStyle(document.body).fontFamily) || "system-ui, sans-serif";
  lines.push(`  --nordvik-font: ${font};`);
  return `:root {\n${lines.join("\n")}\n}`;
}

/** What goes before a card's own CSS. */
export function baseCardCss() {
  return [appVariablesCss(), panelCss, cardBaseCss].join("\n");
}

/** A stylesheet's rules as text. */
export function sheetText(sheet) {
  return Array.from(sheet?.cssRules ?? [], (rule) => rule.cssText).join("\n");
}

// ── The game's custom CSS, as GameStylesheets applies it ────────────────────
let appliedCss = "";
const listeners = new Set();

export const appliedGameCss = () => appliedCss;

export function setAppliedGameCss(css) {
  const next = css ?? "";
  if (next === appliedCss) return;
  appliedCss = next;
  listeners.forEach((listener) => listener(next));
}

/** Calls back with the new CSS whenever it changes; returns the unsubscribe. */
export function onGameCssChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ── Into the card's HTML ─────────────────────────────────────────────────────
const base64Utf8 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

// data: links, not inline <style>: CSS text could contain "</style>".
const styleLink = (id, css) =>
  `<link rel="stylesheet" id="${id}" href="data:text/css;charset=utf-8;base64,${base64Utf8(css)}">`;

/** The card's own CSS tags, wrapped in the app's base (before) and the theme (after). */
export function cardStyleLinks(cardCss = "") {
  return [styleLink("nm-app-base", baseCardCss()), cardCss, styleLink("nm-app-theme", appliedGameCss())]
    .filter(Boolean)
    .join("\n");
}
