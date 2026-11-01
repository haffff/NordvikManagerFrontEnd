import { groupOf, switchData, nameOfAdditions } from "./common";

// A ring around the token, kept at the token's size by tokenData.fitToToken: one colour
// and a line width. A colour from a property (a faction's value table, HP thresholds, a
// yes / no like "infected") is one of its own rules, of any kind (a stroke rule).

export const ring = {
  id: "ring",
  title: "Ring",
  writes: [],
  create: ({ group, name = group, label = "Ring" }) => ({ group, name, label, color: "rgba(232,184,75,0.95)", width: 3 }),

  build(p) {
    return {
      additions: [{
        name: p.name, type: "circle", left: 0, top: 0, radius: 50, originX: "center", originY: "center",
        fill: "transparent", stroke: p.color, strokeWidth: p.width, strokeUniform: true,
        tokenData: { anchor: "center", offsetX: 0, offsetY: 0, fitToToken: true, ...switchData(p) },
      }],
    };
  },

  match(additions) {
    if (additions.length !== 1) return null;
    const [part] = additions;
    if (part.type !== "circle" || !part.tokenData?.fitToToken || part.tokenData.propDeps?.length) return null;
    return { ...groupOf(part.tokenData), name: nameOfAdditions(additions), color: part.stroke, width: part.strokeWidth };
  },
};
