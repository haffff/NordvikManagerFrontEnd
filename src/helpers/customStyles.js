import { ActiveWebHelper } from "./transport";
import WebHelper from "./WebHelper";

// Custom game styling: CSS materials the GM picks for everyone (a game
// property) and ones each player picks for themselves (this browser only),
// loaded into the page by GameStylesheets.js.
//
// A GM's stylesheet runs on every player's client, so it's sanitised before
// it's applied — the browser parses it (new CSSStyleSheet), which also
// resolves CSS escapes a text filter could be fooled by, and then:
//   - @import is refused by constructable stylesheets themselves;
//   - any declaration whose url() / image-set() points anywhere but a data:
//     URI, this app, or this game's own material URLs is dropped — an
//     external URL would leak every player's IP to its host, and attribute
//     selectors (input[value^="a"] { background: url(...) }) could send what
//     they type.
// Applied through document.adoptedStyleSheets: those come after every
// <style> in the page and sit outside Chakra's @layer cascade layers, so
// they override the app's styling without !important.

export const GAME_STYLESHEETS_PROPERTY = "customStylesheets";
export const DISABLE_STYLES_PARAM = "nostyles";

// ── Material loading ──────────────────────────────────────────────────────────

const cssCache = new Map(); // material id or key -> Promise<string>

/**
 * A text/css material's content, decoded as UTF-8 (the data channel's own
 * text decoding is Latin-1, which garbles any non-ASCII character).
 * Fetched once per id/key per client; "" when it can't be loaded.
 */
export function loadCssMaterial({ id, key } = {}) {
  const cacheKey = id || key;
  if (!cacheKey) return Promise.resolve("");
  if (!cssCache.has(cacheKey)) {
    cssCache.set(
      cacheKey,
      ActiveWebHelper.getMaterialAsync(id, "application/octet-stream", key)
        .then((data) => (data instanceof Blob ? blobToText(data) : typeof data === "string" ? data : ""))
        .catch(() => "")
    );
  }
  return cssCache.get(cacheKey);
}

// UTF-8, like Blob.text() — via FileReader where there's no Blob.text().
function blobToText(blob) {
  if (typeof blob.text === "function") return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob, "utf-8");
  });
}

/** Forget cached CSS so the next load fetches it again (the material changed). */
export function invalidateCssMaterial(idOrKey) {
  if (idOrKey === undefined) cssCache.clear();
  else cssCache.delete(idOrKey);
}

// ── Stylesheet lists (stored as JSON arrays of material ids) ──────────────────

export function parseStylesheetList(value) {
  if (Array.isArray(value)) return value.filter((x) => typeof x === "string" && x);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    return parseStylesheetList(JSON.parse(value));
  } catch {
    return [];
  }
}

const personalKey = (gameId) => `nm_personalStylesheets_${gameId}`;

/** This player's own stylesheets for a game — kept in this browser only. */
export function getPersonalStylesheets(gameId) {
  try {
    return parseStylesheetList(localStorage.getItem(personalKey(gameId)));
  } catch {
    return [];
  }
}

export function setPersonalStylesheets(gameId, ids) {
  try {
    localStorage.setItem(personalKey(gameId), JSON.stringify(parseStylesheetList(ids)));
  } catch {
    /* storage unavailable (private mode) — the choice just isn't remembered */
  }
}

export function customStylesDisabled(search = window.location.search) {
  return new URLSearchParams(search).has(DISABLE_STYLES_PARAM);
}

// ── Sanitising ────────────────────────────────────────────────────────────────

const materialUrlPrefix = () => `${WebHelper.ApiAddress}/Materials/Resource?`.toLowerCase();

/**
 * Whether a stylesheet may load this URL: data: URIs, this app's own origin,
 * and this game's material URLs (what "Copy link" on a material gives).
 */
export function isAllowedStyleUrl(url, { origin = window.location.origin, materialPrefix = materialUrlPrefix() } = {}) {
  const u = String(url ?? "").trim();
  if (!u) return true;
  if (/^data:/i.test(u)) return true;
  if (u.toLowerCase().startsWith(materialPrefix)) return true;
  let resolved;
  try {
    resolved = new URL(u, origin + "/");
  } catch {
    return false;
  }
  return resolved.origin === origin;
}

// url("x"), url('x'), url(x); and image-set("x" 1x) / -webkit-image-set,
// whose bare strings are URLs too.
const URL_FN_RE = /url\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^)\s]*))\s*\)/gi;
const IMAGE_SET_RE = /image-set\(([^)]*)\)/gi;
const QUOTED_RE = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;

/** Every URL a CSS value would load. */
export function cssValueUrls(value) {
  const text = String(value ?? "");
  const urls = [];
  for (const m of text.matchAll(URL_FN_RE)) urls.push(m[1] ?? m[2] ?? m[3] ?? "");
  for (const m of text.matchAll(IMAGE_SET_RE)) {
    const inner = m[1].replace(URL_FN_RE, "");
    for (const q of inner.matchAll(QUOTED_RE)) urls.push(q[1] ?? q[2] ?? "");
  }
  return [...new Set(urls)];
}

function declarationAllowed(name, value, allowUrl) {
  // A custom property keeps its raw text, CSS escapes included, until a
  // var() uses it — so a "\75 rl(" there would only become url( later.
  if (name.startsWith("--") && value.includes("\\")) return false;
  return cssValueUrls(value).every(allowUrl);
}

/**
 * Removes every declaration that would load a disallowed URL, in place, from
 * a parsed stylesheet (or anything shaped like CSSOM: cssRules, and rules
 * with a `style` declaration list). Returns how many were removed.
 */
export function sanitizeStyleSheet(sheet, allowUrl = (u) => isAllowedStyleUrl(u)) {
  let removed = 0;
  const walk = (rules) => {
    for (const rule of Array.from(rules ?? [])) {
      const style = rule.style;
      if (style) {
        const names = [];
        for (let i = 0; i < style.length; i++) names.push(style.item(i));
        for (const name of names) {
          if (!declarationAllowed(name, style.getPropertyValue(name), allowUrl)) {
            style.removeProperty(name);
            removed++;
          }
        }
      }
      if (rule.cssRules) walk(rule.cssRules);
    }
  };
  walk(sheet?.cssRules);
  return removed;
}

/**
 * Parses CSS text into a sanitised constructable stylesheet, or null where
 * the browser has no constructable stylesheets (nothing is applied then).
 */
export function buildStyleSheet(cssText) {
  if (typeof CSSStyleSheet === "undefined" || typeof CSSStyleSheet.prototype.replaceSync !== "function") return null;
  const sheet = new CSSStyleSheet();
  try {
    sheet.replaceSync(String(cssText ?? ""));
  } catch (e) {
    console.warn("Custom stylesheet could not be parsed", e);
    return null;
  }
  const removed = sanitizeStyleSheet(sheet);
  if (removed) console.warn(`Custom stylesheet: removed ${removed} declaration(s) loading external URLs`);
  return sheet;
}
