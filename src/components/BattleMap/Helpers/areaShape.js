// What an area on the map covers — the one rule for highlighting tokens (aiming with
// RequestPoint, measuring), the same as the server's AreaShape (Find): a token counts when
// the circle inside it (radius half its shorter side) touches the shape. Both are tested on
// area-cases.json, shared with NordvikManager-Backend.
//
// An area, in map pixels: { shape, x, y, radius, width, height, angle, toward } — a circle or
// rect centred on x, y; a line or cone starting at x, y and pointing at toward ({ x, y }).
// radius is a circle's radius or a line's / cone's length, width a rect's or line's width,
// angle a cone's spread in degrees.

const EPSILON = 1e-6;

export function touchesToken(area, token) {
  return areaDistance(area, token.x, token.y) <= Math.min(token.w, token.h) / 2 + EPSILON;
}

// How far a point is from the area; 0 inside it.
export function areaDistance(area, px, py) {
  switch (area?.shape) {
    case "circle":
      return Math.max(0, Math.hypot(px - area.x, py - area.y) - area.radius);
    case "rect": {
      const dx = Math.max(0, Math.abs(px - area.x) - area.width / 2);
      const dy = Math.max(0, Math.abs(py - area.y) - area.height / 2);
      return Math.hypot(dx, dy);
    }
    case "line":
    case "cone":
      return polygonDistance(areaPolygon(area), px, py);
    default:
      throw new Error(`An area is circle, rect, line or cone, not '${area?.shape}'.`);
  }
}

// A line's or cone's corners ({ x, y }), as the map draws them: a cone is a triangle.
export function areaPolygon(area) {
  const { x, y, toward } = area;
  if (!toward || (toward.x === x && toward.y === y)) throw new Error(`A ${area.shape} needs a direction (toward).`);
  const dir = Math.atan2(toward.y - y, toward.x - x);
  const length = area.radius;
  if (area.shape === "cone") {
    const half = ((area.angle ?? 53) * Math.PI) / 360;
    return [
      { x, y },
      { x: x + length * Math.cos(dir - half), y: y + length * Math.sin(dir - half) },
      { x: x + length * Math.cos(dir + half), y: y + length * Math.sin(dir + half) },
    ];
  }
  const ux = Math.cos(dir), uy = Math.sin(dir);
  const nx = (-uy * area.width) / 2, ny = (ux * area.width) / 2;
  const ex = x + ux * length, ey = y + uy * length;
  return [
    { x: x + nx, y: y + ny },
    { x: ex + nx, y: ey + ny },
    { x: ex - nx, y: ey - ny },
    { x: x - nx, y: y - ny },
  ];
}

function polygonDistance(polygon, px, py) {
  if (inside(polygon, px, py)) return 0;
  let best = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    best = Math.min(best, segmentDistance(polygon[i], polygon[(i + 1) % polygon.length], px, py));
  }
  return best;
}

// Convex polygons only (lines, cones): the point is on the same side of every edge.
function inside(polygon, px, py) {
  let sign = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const s = Math.sign((b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x));
    if (s === 0) continue;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

function segmentDistance(a, b, px, py) {
  const vx = b.x - a.x, vy = b.y - a.y;
  const lengthSq = vx * vx + vy * vy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / lengthSq));
  return Math.hypot(px - (a.x + t * vx), py - (a.y + t * vy));
}
