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

// One axis resized to `size` around its fixed side (or its centre when both sides move).
const place = (start, end, move, size) => {
  if (move === "end") return [start, start + size];
  if (move === "start") return [end - size, end];
  const c = (start + end) / 2;
  return [c - size / 2, c + size / 2];
};

/**
 * @param box       { left, top, width, height } — the scaled, unrotated box
 * @param gridSize  grid cell size
 * @param moveX     "left" | "right" | "both" | null — which vertical edges are dragged
 * @param moveY     "top" | "bottom" | "both" | null
 * @param offset    where grid lines sit (gridSize / 2 when aligning to cell centres)
 * @param keepRatio with both axes moving (a corner): keep the box's proportions — the side
 *                  needing the smaller change snaps to the grid, the other follows it
 */
export function snapScaledBox(box, { gridSize, moveX, moveY, offset = 0, keepRatio = false }) {
  const toAxis = (m, startName) => (m === "both" ? "both" : m === startName ? "start" : m ? "end" : null);
  const x = [box.left, box.left + box.width, toAxis(moveX, "left")];
  const y = [box.top, box.top + box.height, toAxis(moveY, "top")];
  const [left, right] = snapAxis(x[0], x[1], x[2], gridSize, offset);
  const [top, bottom] = snapAxis(y[0], y[1], y[2], gridSize, offset);

  if (keepRatio && x[2] && y[2] && box.width > 0 && box.height > 0) {
    const ratio = box.width / box.height;
    const byWidth = { x: [left, right], y: place(y[0], y[1], y[2], (right - left) / ratio) };
    const byHeight = { x: place(x[0], x[1], x[2], (bottom - top) * ratio), y: [top, bottom] };
    const change = (snapped, original) => Math.abs(snapped - original) / original;
    const pick = change(right - left, box.width) <= change(bottom - top, box.height) ? byWidth : byHeight;
    return { left: pick.x[0], top: pick.y[0], width: pick.x[1] - pick.x[0], height: pick.y[1] - pick.y[0] };
  }

  return { left, top, width: right - left, height: bottom - top };
}
