// Tracing for development: on in dev builds, off in production unless
// localStorage.nm_debug is set (handy when diagnosing a player's connection).
// Warnings and errors still go to console.warn / console.error directly.
export function debugEnabled({ production = process.env.NODE_ENV === "production" } = {}) {
  if (!production) return true;
  try {
    return !!localStorage.getItem("nm_debug");
  } catch {
    return false;
  }
}

export function debugLog(...args) {
  if (debugEnabled()) console.log(...args);
}
