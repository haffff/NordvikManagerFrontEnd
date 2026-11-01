import { placement, groupOf, tokenData, transform, readTransform, nameOfAdditions } from "./common";
import { RULE_KINDS } from "../rules/ruleKinds";

// A bar (e.g. HP): a background and a fill whose width follows value / max and whose
// colour changes at thresholds given in % of max. Same parts as the dnd5e HP bar.

// The width: value 0…max onto 0…the bar's width (a Range rule).
const readWidth = (dep) => {
  const r = dep?.objectProperty === "width" ? RULE_KINDS.range.parse(dep) : null;
  return r && r.from[0] === "0" && r.to[0] === "0" && Number.isFinite(Number(r.to[1])) ? r : null;
};
const widthDep = (a) => a.tokenData?.propDeps?.find(readWidth);

const rect = (p, name, extra) => ({
  name, type: "rect", left: 0, top: 0, width: p.width, height: p.height, originX: "center", originY: "top", rx: 3, ry: 3, ...transform(p), ...extra,
});

export const bar = {
  id: "bar",
  title: "Bar",
  // The object properties its own rules set (the rest are the part's own).
  writes: ["width", "fill"],
  create: ({ group, name = group, label = "Bar" }) => ({
    group, name, label, value: "hp", max: "maxhp", source: "card", width: 100, height: 8,
    background: "rgba(20,20,20,0.75)",
    colors: [
      { upTo: 25, color: "rgba(200,50,50,0.9)" },
      { upTo: 50, color: "rgba(200,160,50,0.9)" },
      { upTo: 100, color: "rgba(50,200,50,0.9)" },
    ],
    anchor: "bottom", offsetX: 0, offsetY: 4, scale: 1, rotation: 0,
  }),

  build(p) {
    // The colour: thresholds in % of max, the last also above max (healed past it).
    const deps = [
      { ...RULE_KINDS.range.build({ property: p.value, from: ["0", p.max], to: ["0", p.width] }), objectProperty: "width", type: "number", source: p.source },
      {
        ...RULE_KINDS.thresholds.build({ property: p.value, max: p.max, steps: p.colors.map((c) => ({ upTo: c.upTo, value: c.color })), fallback: p.colors[0].color }),
        objectProperty: "fill", type: "string", source: p.source,
      },
    ];
    return {
      additions: [
        rect(p, `${p.name}_bg`, { fill: p.background, stroke: "rgba(0,0,0,0.5)", strokeWidth: 1, tokenData: tokenData(p) }),
        rect(p, `${p.name}_fill`, { fill: p.colors.at(-1).color, stroke: null, strokeWidth: 0, tokenData: tokenData(p, { propDeps: deps }) }),
      ],
    };
  },

  /** The file's parts with the rebuilt ones, by role (background / fill), in the file's order. */
  pair(originals, [bg, fill]) {
    if (originals.length !== 2) return [[bg, null], [fill, null]];
    return originals.map((o) => [widthDep(o) ? fill : bg, o]);
  },

  match(additions) {
    if (additions.length !== 2 || !additions.every((a) => a.type === "rect")) return null;
    const fill = additions.find(widthDep);
    const bg = additions.find((a) => a !== fill);
    if (!fill || bg.tokenData?.propDeps?.length) return null;

    const dep = widthDep(fill);
    const { property: value, from: [, max], to: [, width] } = readWidth(dep);
    let colors = [{ upTo: 100, color: fill.fill }];
    const colour = fill.tokenData.propDeps.find((d) => d.objectProperty === "fill");
    if (colour) {
      const steps = RULE_KINDS.thresholds.parse(colour)?.steps;
      if (!steps) return null;
      colors = steps.map((s) => ({ upTo: s.upTo, color: s.value }));
    }
    return {
      ...groupOf(bg.tokenData), name: nameOfAdditions(additions), value, max, source: dep.source, width: Number(width), height: bg.height,
      background: bg.fill, colors, ...placement(bg.tokenData), ...readTransform(bg),
    };
  },
};
