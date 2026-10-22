// Measuring on the map (the Tools panel's Line, Radius, Cone and Rect): the area a drag from
// `from` to `to` covers — the same shapes as markers and Find (areaShape.js, buildArea.js) —
// and the text shown next to it, in the map's units ({ gridSize, units, distancePerSquare,
// realisticMeasure }, from the map's or the game's settings).

// { area, at, toward } for buildAreaObject / placeArea, or null for a line (a ruler arrow).
export function measureArea(type, from, to, coneAngle = 53) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  switch (type) {
    case "Circle":
      return { area: { shape: "circle", radius: length }, at: from };
    case "Cone":
      return { area: { shape: "cone", radius: length, angle: coneAngle }, at: from, toward: to };
    case "Rect":
      return {
        area: { shape: "rect", width: Math.abs(to.x - from.x), height: Math.abs(to.y - from.y) },
        at: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
      };
    default:
      return null;
  }
}

export function measureLabel(type, from, to, { gridSize, units = "ft", distancePerSquare = 5, realisticMeasure = false }) {
  const dx = Math.abs(to.x - from.x), dy = Math.abs(to.y - from.y);
  const inUnits = (px) => Number(((px / gridSize) * distancePerSquare).toFixed(0));
  if (type === "Rect") return `${inUnits(dx)} × ${inUnits(dy)} ${units}`;
  if (type === "Circle") return `${inUnits(Math.hypot(dx, dy))}${units} r`;
  return `${inUnits(realisticMeasure ? Math.hypot(dx, dy) : Math.max(dx, dy))}${units}`;
}
