// Snapping a box being resized to the map grid. Only the edges being dragged move: each
// lands on the nearest grid line, the others stay where they are. An edge that would
// reach (or cross) the fixed one stops at the last grid line before it instead.

const nearest = (v, g, offset) => Math.round((v - offset) / g) * g + offset;
const lineAfter = (v, g, offset) => Math.floor((v - offset) / g + 1) * g + offset;
const lineBefore = (v, g, offset) => Math.ceil((v - offset) / g - 1) * g + offset;

// One axis: [start, end] with `move` = "start" | "end" | "both" | null.
const snapAxis = (start, end, move, g, offset) => {
  if (!move) return [start, end];
  if (move === "both") {
    const s = nearest(start, g, offset);
    const e = nearest(end, g, offset);
    return e > s ? [s, e] : [s, s + g];
  }
  if (move === "end") {
    const e = nearest(end, g, offset);
    return [start, e > start ? e : lineAfter(start, g, offset)];
  }
  const s = nearest(start, g, offset);
  return [s < end ? s : lineBefore(end, g, offset), end];
};

/**
 * @param box       { left, top, width, height } — the scaled, unrotated box
 * @param gridSize  grid cell size
 * @param moveX     "left" | "right" | "both" | null — which vertical edges are dragged
 * @param moveY     "top" | "bottom" | "both" | null
 * @param offset    where grid lines sit (gridSize / 2 when aligning to cell centres)
 */
export function snapScaledBox(box, { gridSize, moveX, moveY, offset = 0 }) {
  const toAxis = (m, startName) => (m === "both" ? "both" : m === startName ? "start" : m ? "end" : null);
  const [left, right] = snapAxis(box.left, box.left + box.width, toAxis(moveX, "left"), gridSize, offset);
  const [top, bottom] = snapAxis(box.top, box.top + box.height, toAxis(moveY, "top"), gridSize, offset);
  return { left, top, width: right - left, height: bottom - top };
}
