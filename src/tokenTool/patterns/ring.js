import { groupOf, onlyDep, switchData, nameOfAdditions } from "./common";
import { RULE_KINDS } from "../rules/ruleKinds";

// A ring around the token, kept at the token's size by tokenData.fitToToken. It has one
// colour, or a colour per value of a property (e.g. faction: ally/enemy) with otherColor
// for any other value (transparent: no ring).

export const ring = {
  id: "ring",
  title: "Ring",
  writes: ["stroke"],
  create: ({ group, name = group, label = "Ring" }) => ({
    group, name, label, color: "rgba(232,184,75,0.95)", width: 3, property: "", source: "card", colors: {}, otherColor: "transparent",
  }),

  build(p) {
    const propDeps = p.property
      ? [{
        ...RULE_KINDS.table.build({ property: p.property, entries: Object.entries(p.colors).map(([when, value]) => ({ when, value })), other: p.otherColor }),
        objectProperty: "stroke", type: "string", source: p.source,
      }]
      : [];
    return {
      additions: [{
        name: p.name, type: "circle", left: 0, top: 0, radius: 50, originX: "center", originY: "center",
        fill: "transparent", stroke: p.color, strokeWidth: p.width, strokeUniform: true,
        tokenData: {
          anchor: "center", offsetX: 0, offsetY: 0, fitToToken: true, ...switchData(p),
          ...(propDeps.length ? { propDeps } : {}),
        },
      }],
    };
  },

  match(additions) {
    if (additions.length !== 1) return null;
    const [part] = additions;
    if (part.type !== "circle" || !part.tokenData?.fitToToken) return null;
    let property = "", colors = {}, source = "card", otherColor = "transparent";
    if (part.tokenData.propDeps?.length) {
      const dep = onlyDep(part);
      const table = dep?.objectProperty === "stroke" ? RULE_KINDS.table.parse(dep) : null;
      if (!table) return null;
      colors = Object.fromEntries(table.entries.map((e) => [e.when, e.value]));
      property = table.property;
      source = dep.source;
      // Without one, other values keep the ring's last colour; the editor always writes one.
      otherColor = table.other || part.stroke;
    }
    return { ...groupOf(part.tokenData), name: nameOfAdditions(additions), color: part.stroke, width: part.strokeWidth, property, source, colors, otherColor };
  },
};
