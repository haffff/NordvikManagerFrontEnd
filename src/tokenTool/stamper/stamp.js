// The token stamper: a picture (e.g. a portrait) becomes a square token image — the part
// picked by zoom and pan, optionally cut to a circle (transparent corners) and ringed.
// Everything happens in the browser; nothing is uploaded.

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * The square of the picture to use, in picture pixels. Zoom 1 is the largest square that
 * fits; more zooms in around the centre, moved by panX/panY and kept inside the picture.
 */
export function stampLayout({ imgW, imgH, zoom = 1, panX = 0, panY = 0 }) {
  const side = Math.min(imgW, imgH) / Math.max(zoom, 1);
  const sx = clamp((imgW - side) / 2 + panX, 0, imgW - side);
  const sy = clamp((imgH - side) / 2 + panY, 0, imgH - side);
  return { sx, sy, side };
}

/**
 * Draws the token image on a 2D context of a size × size canvas.
 * @param options { size, layout (from stampLayout), circle?, ring?: { width, color } }
 */
export function stamp(ctx, image, { size, layout, circle = false, ring = null }) {
  const centre = size / 2;
  ctx.clearRect(0, 0, size, size);

  ctx.save();
  if (circle) {
    ctx.beginPath();
    ctx.arc(centre, centre, centre, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
  }
  ctx.drawImage(image, layout.sx, layout.sy, layout.side, layout.side, 0, 0, size, size);
  ctx.restore();

  if (!(ring?.width > 0)) return;
  // Stroked down its middle line, so the whole ring stays inside the image.
  const inset = ring.width / 2;
  ctx.strokeStyle = ring.color;
  ctx.lineWidth = ring.width;
  if (circle) {
    ctx.beginPath();
    ctx.arc(centre, centre, centre - inset, 0, Math.PI * 2);
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.strokeRect(inset, inset, size - ring.width, size - ring.width);
  }
}

/**
 * The view after dragging the shown square by dx/dy screen pixels (it is `shown` pixels
 * wide): the picture follows the pointer, kept inside its edges.
 */
export function panBy(view, { dx, dy, shown }) {
  const { side } = stampLayout(view);
  const scale = side / shown;
  const moved = stampLayout({ ...view, panX: view.panX - dx * scale, panY: view.panY - dy * scale });
  // Stored as the clamped offset, so a drag past the edge doesn't need undoing first
  // (+ 0 turns -0 into 0).
  return { ...view, panX: moved.sx - (view.imgW - side) / 2 + 0, panY: moved.sy - (view.imgH - side) / 2 + 0 };
}
