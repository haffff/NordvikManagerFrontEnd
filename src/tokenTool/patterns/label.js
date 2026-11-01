import { placement, groupOf, tokenData, onlyDep, transform, readTransform, nameOfAdditions } from "./common";

// A text label showing one property (a name, AC, a counter). Same part as the dnd5e
// name label.

export const label = {
  id: "label",
  title: "Label",
  writes: ["text"],
  create: ({ group, name = group, label: title = "Label" }) => ({
    group, name, label: title, property: "name", source: "card", fontSize: 11, fontFamily: "Arial", fontWeight: "bold",
    color: "rgba(255,255,255,0.95)", outline: "rgba(0,0,0,0.8)", width: 100, anchor: "bottom", offsetX: 0, offsetY: 16, scale: 1, rotation: 0,
  }),

  build(p) {
    return {
      additions: [{
        name: p.name, type: "text", left: 0, top: 0, width: p.width, height: Math.round(p.fontSize * 1.1),
        originX: "center", originY: "top", text: "",
        fontSize: p.fontSize, fontFamily: p.fontFamily, fontWeight: p.fontWeight,
        fill: p.color, stroke: p.outline, strokeWidth: p.outline ? 0.5 : 0, textAlign: "center", ...transform(p),
        tokenData: tokenData(p, { propDeps: [{ dtoProperty: p.property, objectProperty: "text", type: "string", source: p.source }] }),
      }],
    };
  },

  match(additions) {
    if (additions.length !== 1) return null;
    const [part] = additions;
    const dep = onlyDep(part);
    if (!["text", "i-text"].includes(part.type) || dep?.objectProperty !== "text" || !dep.dtoProperty || dep.expression) return null;
    return {
      ...groupOf(part.tokenData), name: nameOfAdditions(additions), property: dep.dtoProperty, source: dep.source,
      fontSize: part.fontSize, fontFamily: part.fontFamily, fontWeight: part.fontWeight,
      color: part.fill, outline: part.stroke ?? null, width: part.width, ...placement(part.tokenData), ...readTransform(part),
    };
  },
};
