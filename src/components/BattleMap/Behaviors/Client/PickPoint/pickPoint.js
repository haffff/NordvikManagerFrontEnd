// Pointing at a place on a battle map for an action (RequestPoint): the marker follows the
// cursor, snapped to the grid when asked, and only a point within range can be chosen.
// Pure, so the mode is easy to test; BMService.SetPickPointMode draws it.

export const startPointing = ({ message = "", marker = null, snap = "none", range = null, highlight = true, showToOthers = true } = {}, gridSize = 50) => ({
  message,
  marker,
  snap: snap === "center" || snap === "corner" ? snap : "none",
  range,
  highlight,
  showToOthers,
  gridSize: gridSize > 0 ? gridSize : 50,
  position: null,
  allowed: false,
});

// center: the middle of a square; corner: where grid lines cross; none: whole pixels.
export function snapPoint({ x, y }, gridSize, snap) {
  if (snap === "center") return { x: Math.floor(x / gridSize) * gridSize + gridSize / 2, y: Math.floor(y / gridSize) * gridSize + gridSize / 2 };
  if (snap === "corner") return { x: Math.round(x / gridSize) * gridSize, y: Math.round(y / gridSize) * gridSize };
  return { x: Math.round(x), y: Math.round(y) };
}

export function inRange({ x, y }, range) {
  if (!range) return true;
  return Math.hypot(x - range.x, y - range.y) <= range.radius;
}

// Whether a marker at `at` covers a token (its centre x, y and size w, h) — for a circle the
// rule of Find with Near and Radius: the centre within the radius plus half the token.
export function covers(marker, at, token) {
  if (marker?.type === "circle") {
    return Math.hypot(token.x - at.x, token.y - at.y) <= marker.radius + Math.min(token.w, token.h) / 2;
  }
  if (marker?.type === "rect") {
    return Math.abs(token.x - at.x) <= (marker.width + token.w) / 2 && Math.abs(token.y - at.y) <= (marker.height + token.h) / 2;
  }
  return false;
}

// The pointer moved to `raw` (map pixels).
export function pointerAt(state, raw) {
  const position = snapPoint(raw, state.gridSize, state.snap);
  return { ...state, position, allowed: inRange(position, state.range) };
}

// Calls `fn` at most once every `ms`; a call in between is kept and made when the time is
// up, so the last one always goes. cancel() drops a kept one.
export function throttled(fn, ms) {
  let last = -Infinity;
  let timer = null;
  let pending = null;
  const flush = () => {
    timer = null;
    last = Date.now();
    const args = pending;
    pending = null;
    fn(...args);
  };
  const call = (...args) => {
    pending = args;
    if (timer) return;
    const wait = last + ms - Date.now();
    if (wait <= 0) flush();
    else timer = setTimeout(flush, wait);
  };
  call.cancel = () => {
    clearTimeout(timer);
    timer = null;
    pending = null;
  };
  return call;
}
