import { placement, groupOf, tokenData, onlyDep, transform, readTransform, nameOfAdditions } from "./common";

// Primitives: a rectangle, a circle or a regular polygon (a marker, a frame, a badge
// behind a label). Always shown, or only while a yes/no property is on (like a status
// icon). Native Fabric shapes, centred on their place.

const round = (n) => Math.round(n * 100) / 100;

/** A regular polygon's corners in a width × height box around 0,0, the first at the top. */
export function regularPoints(sides, width, height) {
  return Array.from({ length: sides }, (_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / sides;
    // + 0 turns -0 into 0
    return { x: round((Math.cos(a) * width) / 2) + 0, y: round((Math.sin(a) * height) / 2) + 0 };
  });
}

const visibleDep = (p) => (p.property
  ? { propDeps: [{ dtoProperty: p.property, objectProperty: "visible", type: "bool", source: p.source }] }
  : {});

// The fields only one kind has.
const KINDS = {
  rect: {
    title: "Rectangle", type: "rect",
    defaults: { width: 16, height: 16, corner: 0 },
    geometry: (p) => ({ width: p.width, height: p.height, rx: p.corner, ry: p.corner }),
    // Only a sized rectangle (one this pattern makes); a bare one stays as it is.
    read: (part) => (typeof part.width === "number" && typeof part.height === "number"
      ? { width: part.width, height: part.height, corner: part.rx ?? 0 } : null),
  },
  circle: {
    title: "Circle", type: "circle",
    defaults: { width: 16 },
    geometry: (p) => ({ radius: p.width / 2 }),
    read: (part) => (typeof part.radius === "number" ? { width: part.radius * 2 } : null),
  },
  polygon: {
    title: "Polygon", type: "polygon",
    defaults: { sides: 6, width: 16, height: 16 },
    geometry: (p) => ({ width: p.width, height: p.height, points: regularPoints(p.sides, p.width, p.height) }),
    read(part) {
      const sides = part.points?.length;
      if (!sides || sides < 3 || !part.width || !part.height) return null;
      // Only the polygons this pattern makes; one drawn by hand stays as it is.
      const regular = regularPoints(sides, part.width, part.height);
      const same = regular.every((pt, i) => Math.abs(pt.x - part.points[i].x) < 0.05 && Math.abs(pt.y - part.points[i].y) < 0.05);
      return same ? { sides, width: part.width, height: part.height } : null;
    },
  },
};

function shape(id) {
  const kind = KINDS[id];
  return {
    id,
    title: kind.title,
    writes: ["visible"],
    create: ({ group, name = group, label = kind.title }) => ({
      group, name, label, ...kind.defaults, fill: "rgba(232,184,75,0.9)", stroke: "rgba(0,0,0,0.6)", strokeWidth: 1,
      property: "", source: "card", anchor: "left-bottom", offsetX: 0, offsetY: 0, scale: 1, rotation: 0,
    }),

    build(p) {
      return {
        additions: [{
          name: p.name, type: kind.type, left: 0, top: 0, originX: "center", originY: "center",
          ...kind.geometry(p), fill: p.fill, stroke: p.stroke, strokeWidth: p.strokeWidth, ...transform(p),
          ...(p.property ? { visible: false } : {}),
          tokenData: tokenData(p, visibleDep(p)),
        }],
      };
    },

    match(additions) {
      if (additions.length !== 1) return null;
      const [part] = additions;
      if (part.type !== kind.type || part.tokenData?.fitToToken || part.tokenData?.actions) return null;
      const deps = part.tokenData?.propDeps ?? [];
      const dep = onlyDep(part);
      if (deps.length && !(dep?.objectProperty === "visible" && dep.dtoProperty && !dep.expression)) return null;
      const geometry = kind.read(part);
      if (!geometry) return null;
      return {
        ...groupOf(part.tokenData), name: nameOfAdditions(additions), ...geometry, fill: part.fill, stroke: part.stroke ?? null, strokeWidth: part.strokeWidth ?? 0,
        property: dep?.dtoProperty ?? "", source: dep?.source ?? "card", ...placement(part.tokenData), ...readTransform(part),
      };
    },
  };
}

export const rect = shape("rect");
export const circle = shape("circle");
export const polygon = shape("polygon");
