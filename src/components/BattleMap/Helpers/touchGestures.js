// Touch on the battle map: one finger on the empty map pans it (OnDragStart), two fingers
// pinch-zoom and pan, and a finger held still opens the map's right-click menu.
//
// Fabric itself follows only the first finger, and hands the behaviours the raw
// TouchEvent, which has no clientX of its own (touchPoint reads it).

const MIN_ZOOM = 0.01;
const MAX_ZOOM = 10;

/** Where a mouse or touch event is on screen. */
export function touchPoint(e) {
  const t = e?.touches?.[0] ?? e?.changedTouches?.[0] ?? e;
  return { x: t?.clientX, y: t?.clientY };
}

export const isTouchEvent = (e) => typeof e?.type === "string" && e.type.startsWith("touch");

// The canvas modes in which a press belongs to a tool (measuring, drawing, placing,
// picking...), not to panning.
const TOOL_FLAGS = [
  "measureMode", "freeDrawMode", "isDrawingMode", "simpleCreateMode", "editGridMode",
  "tokenSelectMode", "actionTool", "pickPoint", "pickTargets",
];

/** Whether a finger pressed on target pans the map: nothing it can move there, no tool on. */
export function touchPans(canvas, target) {
  if (target?.selectable) return false;
  return !TOOL_FLAGS.some((flag) => canvas?.[flag]);
}

export const clampZoom = (zoom) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * From two fingers at prev to the same two at next: how much to scale, about which
 * screen point (their new midpoint), after moving the map with their midpoint.
 */
export function pinchStep([a0, b0], [a1, b1]) {
  const before = distance(a0, b0);
  const scale = before > 0 ? distance(a1, b1) / before : 1;
  const m0 = midpoint(a0, b0);
  const center = midpoint(a1, b1);
  return { scale, center, pan: { x: center.x - m0.x, y: center.y - m0.y } };
}

// Drops what the first finger started before the second landed: the map pan, the
// selection rubber band, or a token drag (the token goes back where it was; fabric then
// sends no move for it).
function cancelCanvasInteraction(canvas) {
  canvas.isDragging = false;
  canvas._groupSelector = null;
  const transform = canvas._currentTransform;
  if (transform?.target && transform.original) {
    transform.target.set({ left: transform.original.left, top: transform.original.top });
    transform.target.setCoords?.();
  }
  canvas._currentTransform = null;
}

/**
 * Follows the fingers on a battle map canvas: down/move/up per pointer id with screen
 * coordinates. move() answers whether it took the move (a pinch), so fabric must not see it.
 *
 * rect() — the canvas element's screen rect; onLongPress({ x, y }) — a finger held still.
 */
export function createTouchGestures({ canvas, rect, onLongPress, longPressMs = 550, slop = 10 }) {
  const points = new Map(); // pointer id → { x, y, startX, startY }
  let pinching = false; // from the second finger landing until every finger is up
  let longPress = null;

  const cancelLongPress = () => {
    if (longPress) clearTimeout(longPress);
    longPress = null;
  };

  const zoomAndPan = (prev, next) => {
    const { scale, center, pan } = pinchStep(prev, next);
    const vpt = canvas.viewportTransform;
    const zoom = canvas.getZoom();
    const newZoom = clampZoom(zoom * scale);
    const factor = newZoom / zoom;
    const r = rect();
    const cx = center.x - r.left;
    const cy = center.y - r.top;
    // Move with the midpoint, then zoom about it: the map point under the fingers stays there.
    vpt[0] = newZoom;
    vpt[3] = newZoom;
    vpt[4] = cx - (cx - (vpt[4] + pan.x)) * factor;
    vpt[5] = cy - (cy - (vpt[5] + pan.y)) * factor;
    canvas.requestRenderAll();
  };

  return {
    isPinching: () => pinching,

    down(id, x, y) {
      points.set(id, { x, y, startX: x, startY: y });
      if (points.size === 1 && !pinching) {
        cancelLongPress();
        if (onLongPress) longPress = setTimeout(() => { longPress = null; onLongPress({ x, y }); }, longPressMs);
      } else if (points.size === 2) {
        cancelLongPress();
        pinching = true;
        cancelCanvasInteraction(canvas);
      }
    },

    move(id, x, y) {
      const point = points.get(id);
      if (!point) return false;
      if (Math.hypot(x - point.startX, y - point.startY) > slop) cancelLongPress();
      const prev = [...points.values()].slice(0, 2).map((p) => ({ x: p.x, y: p.y }));
      point.x = x;
      point.y = y;
      if (!pinching) return false;
      if (points.size >= 2) zoomAndPan(prev, [...points.values()].slice(0, 2));
      return true;
    },

    up(id) {
      if (!points.delete(id)) return;
      cancelLongPress();
      if (!pinching) return;
      // Fabric's object positions follow the viewport only once it is set.
      if (points.size === 1) canvas.setViewportTransform(canvas.viewportTransform);
      if (points.size === 0) pinching = false;
    },
  };
}

/**
 * Hooks the gestures to a battle map canvas. Pointer events drive them (they arrive before
 * the touch events fabric listens to), and a pinch keeps its touch moves from fabric, so the
 * first finger doesn't drag the token or the rubber band under it. Returns the undo.
 */
export function installTouchGestures(canvas, { onLongPress } = {}) {
  const el = canvas?.upperCanvasEl;
  if (!el) return () => {};
  const gestures = createTouchGestures({ canvas, rect: () => el.getBoundingClientRect(), onLongPress });
  const isTouch = (e) => e.pointerType === "touch";

  const onDown = (e) => { if (isTouch(e)) gestures.down(e.pointerId, e.clientX, e.clientY); };
  const onMove = (e) => { if (isTouch(e)) gestures.move(e.pointerId, e.clientX, e.clientY); };
  const onUp = (e) => { if (isTouch(e)) gestures.up(e.pointerId); };
  // Fabric listens for touchmove on the document; the window sees it first.
  const holdTouchMove = (e) => {
    if (!gestures.isPinching()) return;
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
  };

  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  window.addEventListener("touchmove", holdTouchMove, { capture: true, passive: false });
  return () => {
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
    window.removeEventListener("touchmove", holdTouchMove, { capture: true });
  };
}

/**
 * Opens the right-click menu whose trigger is el at a screen point, as a right click
 * there would: what was under the finger is already known from its touch-down.
 */
export function openContextMenuAt(el, { x, y }) {
  el?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 }));
}
