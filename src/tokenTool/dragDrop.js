import { splitParts, addPart, updatePart } from "./patterns/parts";

// Drag and drop in the token editor. A part dropped or dragged on the preview is stored
// as the nearest of the token's 9 anchors plus an offset, the way TokenManager places
// parts (UpdateTokenUIPositions: anchor point + offsetX/offsetY = the part's left/top).
// These edit the token file directly, so nothing the patterns don't model is lost.

/** Drag data type of a palette entry (its value is the pattern's id). */
export const PART_MIME = "application/x-nordvik-token-part";

// Each anchor's point on a token square at (x, y), `size` wide.
const ANCHORS = {
  "left-top": (t) => [t.x, t.y],
  top: (t) => [t.x + t.size / 2, t.y],
  "right-top": (t) => [t.x + t.size, t.y],
  left: (t) => [t.x, t.y + t.size / 2],
  center: (t) => [t.x + t.size / 2, t.y + t.size / 2],
  right: (t) => [t.x + t.size, t.y + t.size / 2],
  "left-bottom": (t) => [t.x, t.y + t.size],
  bottom: (t) => [t.x + t.size / 2, t.y + t.size],
  "right-bottom": (t) => [t.x + t.size, t.y + t.size],
};

/** The nearest anchor to a part's left/top, and the rest as whole-pixel offsets. */
export function pointToAnchorOffset(point, token) {
  let best = null;
  for (const [anchor, at] of Object.entries(ANCHORS)) {
    const [ax, ay] = at(token);
    const distance = Math.hypot(point.x - ax, point.y - ay);
    if (!best || distance < best.distance) best = { anchor, ax, ay, distance };
  }
  return { anchor: best.anchor, offsetX: Math.round(point.x - best.ax) + 0, offsetY: Math.round(point.y - best.ay) + 0 };
}

/**
 * Moves a part, by one of its additions' names, to a placement. The part's other
 * additions on the same anchor keep their distance from it; those on other anchors
 * stay. Other parts in the same mask group stay where they are.
 */
export function movePart(definition, name, placement) {
  const dragged = definition.additions?.find((a) => a.name === name);
  if (!dragged) return definition;
  const from = dragged.tokenData ?? {};
  const anchor = from.anchor ?? "left-top";
  const fromX = from.offsetX ?? 0;
  const fromY = from.offsetY ?? 0;
  // The dragged addition's part (a mask group can hold several parts: only this one moves).
  const part = splitParts(definition).parts.find((p) => p.additions.includes(dragged));
  const together = new Set(part?.additions ?? [dragged]);

  const additions = definition.additions.map((a) => {
    const td = a.tokenData ?? {};
    const moves = a === dragged || (together.has(a) && (td.anchor ?? "left-top") === anchor);
    if (!moves) return a;
    return {
      ...a,
      tokenData: {
        ...td,
        anchor: placement.anchor,
        offsetX: placement.offsetX + ((td.offsetX ?? 0) - fromX),
        offsetY: placement.offsetY + ((td.offsetY ?? 0) - fromY),
        // The top-right corner always stacks its icons (TokenManager); moved away, they
        // keep stacking.
        ...(td.anchor === "right-top" && placement.anchor !== "right-top" ? { stack: true } : {}),
      },
    };
  });
  return { ...definition, additions };
}

const STEP = 12;
// Away from the token: up above it, down below it and at the sides.
const AWAY = { "left-top": -1, top: -1, "right-top": -1 };

/** The placement, or the nearest one further from the token that no part already uses. */
export function freePlace(definition, placement) {
  if (!placement.anchor) return placement;
  const taken = (offsetY) => (definition.additions ?? []).some((a) => {
    const td = a.tokenData ?? {};
    return (td.anchor ?? "left-top") === placement.anchor && (td.offsetX ?? 0) === placement.offsetX && (td.offsetY ?? 0) === offsetY;
  });
  let offsetY = placement.offsetY;
  while (taken(offsetY)) offsetY += STEP * (AWAY[placement.anchor] ?? 1);
  return { ...placement, offsetY };
}

/** Adds a new part of a pattern at a placement, after the token's other parts. */
export function addPatternAt(definition, pattern, placement) {
  const { parts } = splitParts(definition);
  let part = addPart(parts, pattern).at(-1);
  // A ring always sits around the token (anchor centre, fitToToken).
  if ("anchor" in part.params) part = updatePart(part, { ...part.params, ...placement });

  const icons = [...(definition.assignableIcons ?? []), ...part.assignableIcons];
  return {
    ...definition,
    ...(definition.assignableIcons || icons.length ? { assignableIcons: icons } : {}),
    additions: [...(definition.additions ?? []), ...part.additions],
  };
}

