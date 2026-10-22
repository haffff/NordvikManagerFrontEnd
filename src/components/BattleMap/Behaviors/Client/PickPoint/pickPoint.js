// Pointing at a place on a battle map for an action (RequestPoint): the area follows the
// cursor, snapped to the grid when asked, and only a point within range can be chosen. A line
// or cone starts at `from` and the cursor only aims it. Pure, so the mode is easy to test;
// BMService.SetPickPointMode draws it (Helpers/buildArea.js).

// area: { shape, radius, width, height, angle, text, fill, stroke } in pixels, or null for a
// bare point. gridSize: the one the server sized the area and range with, else the map's own.
export const startPointing = ({ message = "", area = null, from = null, snap = "none", range = null, highlight = true, showToOthers = true, gridSize: sent } = {}, gridSize = 50) => ({
  message,
  area,
  from,
  snap: snap === "center" || snap === "corner" ? snap : "none",
  range,
  highlight,
  showToOthers,
  gridSize: sent > 0 ? sent : gridSize > 0 ? gridSize : 50,
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

const aimed = (state) => !!state.from && (state.area?.shape === "line" || state.area?.shape === "cone");

// The area where the pointer is, for the area rule (areaShape.js): centred on the pointer,
// or from `from` toward it; null when there's nothing it covers (no area, text, no pointer).
export function areaAt(state) {
  const { area, position } = state;
  if (!area || area.shape === "text" || !position) return null;
  const { fill, stroke, text, fontSize, ...shape } = area;
  if (aimed(state)) {
    if (position.x === state.from.x && position.y === state.from.y) return null;
    return { ...shape, x: state.from.x, y: state.from.y, toward: position };
  }
  return { ...shape, x: position.x, y: position.y };
}

// The pointer moved to `raw` (map pixels).
export function pointerAt(state, raw) {
  const position = snapPoint(raw, state.gridSize, state.snap);
  const allowed = aimed(state)
    ? position.x !== state.from.x || position.y !== state.from.y
    : inRange(position, state.range);
  return { ...state, position, allowed };
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
