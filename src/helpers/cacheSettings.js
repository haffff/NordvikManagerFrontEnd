// How much browser storage the resource cache may use. Per browser (not per game),
// like personal stylesheets; 0 turns the cache off.
const KEY = "nordvik.resourceCacheLimitMB";

export const DEFAULT_CACHE_LIMIT_MB = 500;

export function getCacheLimitMB() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return DEFAULT_CACHE_LIMIT_MB;
    const mb = Number(raw);
    return Number.isFinite(mb) && mb >= 0 ? mb : DEFAULT_CACHE_LIMIT_MB;
  } catch {
    return DEFAULT_CACHE_LIMIT_MB;
  }
}

export function setCacheLimitMB(mb) {
  try {
    localStorage.setItem(KEY, String(Math.max(0, Math.round(mb))));
  } catch {
    /* storage blocked — the default applies */
  }
}
