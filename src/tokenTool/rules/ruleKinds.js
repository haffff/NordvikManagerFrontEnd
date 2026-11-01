import { splitArgs, RULE_ARG_MAPS } from "../../helpers/TokenExpressionEvaluator";

// A token rule (propDep) as a kind with settings, and back: the one place in the token
// editor that knows the expression syntax the game's evaluator runs
// (helpers/TokenExpressionEvaluator.js, helpers/TokenUIRules.js). Patterns build and read
// their rules through these kinds too.
//
// A rule in the editor: { target (objectProperty), source, type, kind, params }.

/** Above max, the last threshold still applies (healed past max). */
export const ABOVE_MAX = 9999;

// A range end or a max: a number as written, or a property name (%name% in the expression).
const isNumber = (s) => s.trim() !== "" && Number.isFinite(Number(s));
const writeEnd = (v) => (isNumber(String(v)) ? String(v).trim() : `%${v}%`);
const readEnd = (arg) => (isNumber(arg) ? arg : /^%(\w+)%$/.exec(arg)?.[1] ?? null);
const readProp = (arg) => /^%(\w+)%$/.exec(arg ?? "")?.[1] ?? null;

/** A rule call's name and its arguments as written, or null. */
function call(expression) {
  const m = /^(\w+)\((.*)\)\s*$/s.exec(expression ?? "");
  return m ? { name: m[1], inner: m[2], args: splitArgs(m[2]) } : null;
}

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

export const RULE_KINDS = {
  direct: {
    title: "Direct",
    parse(dep) {
      if (dep.rule) return null;
      if (dep.expression) {
        const property = readProp(dep.expression.trim());
        return property ? { property } : null;
      }
      return dep.dtoProperty ? { property: dep.dtoProperty } : null;
    },
    build: ({ property }) => ({ dtoProperty: property }),
  },

  range: {
    title: "Range",
    parse(dep) {
      const c = call(dep.expression);
      if (c?.name !== "FromTo" || c.args.length !== 5) return null;
      const property = readProp(c.args[0]);
      const ends = c.args.slice(1).map(readEnd);
      if (!property || ends.some((e) => e === null)) return null;
      return { property, from: ends.slice(0, 2), to: ends.slice(2) };
    },
    build: ({ property, from, to }) => ({ expression: `FromTo(%${property}%, ${[...from, ...to].map(writeEnd).join(", ")})` }),
  },

  thresholds: {
    title: "Thresholds",
    parse(dep) {
      const c = call(dep.expression);
      if (c?.name !== "FromToEnum" || c.args.length !== 7) return null;
      const [value, valueMin, max, targetMin, targetMax, fallback, ranges] = c.args;
      const property = readProp(value);
      const maxEnd = readEnd(max);
      if (!property || maxEnd === null || valueMin !== "0" || targetMin !== "0" || targetMax !== "100") return null;
      const list = parseJson(ranges);
      if (!Array.isArray(list) || !list.length) return null;
      // One after another from 0: what this kind makes.
      if (list.some((r, i) => r.min !== (i === 0 ? 0 : list[i - 1].max))) return null;
      return {
        property, max: maxEnd, fallback,
        steps: list.map((r, i) => ({ upTo: i === list.length - 1 ? 100 : r.max, value: r.enumValue })),
      };
    },
    build({ property, max, steps, fallback }) {
      const ranges = steps.map((s, i) => ({
        min: i === 0 ? 0 : steps[i - 1].upTo,
        max: i === steps.length - 1 ? ABOVE_MAX : s.upTo,
        enumValue: s.value,
      }));
      return { expression: `FromToEnum(%${property}%, 0, ${writeEnd(max)}, 0, 100, ${fallback}, ${JSON.stringify(ranges)})` };
    },
  },

  table: {
    title: "Table",
    parse(dep) {
      const c = call(dep.expression);
      if (c?.name !== "Enum" || c.args.length < 2 || c.args.length > 3) return null;
      const property = readProp(c.args[0]);
      const object = parseJson(c.args[1]);
      if (!property || !object || typeof object !== "object" || Array.isArray(object)) return null;
      return { property, entries: Object.entries(object).map(([when, value]) => ({ when, value: String(value) })), other: c.args[2] ?? "" };
    },
    build({ property, entries, other }) {
      const object = Object.fromEntries(entries.map((e) => [e.when, e.value]));
      return { expression: `Enum(%${property}%, ${JSON.stringify(object)}${other ? `, ${other}` : ""})` };
    },
  },

  formula: {
    title: "Formula",
    parse(dep) {
      const c = call(dep.expression);
      if (c?.name !== "Math" || c.args.length < 2) return null;
      // The first argument is `value` in the formula; the formula is everything after it.
      const [value] = c.args;
      const after = c.inner.indexOf(",", c.inner.indexOf(value) + value.length);
      return { value, formula: c.inner.slice(after + 1).trim() };
    },
    build: ({ value, formula }) => ({ expression: `Math(${value || "0"}, ${formula})` }),
  },

  expression: {
    title: "Expression",
    parse: (dep) => (dep.expression && !dep.rule ? { text: dep.expression } : null),
    build: ({ text }) => ({ expression: text }),
  },

  // The old dtoProperty + rule form: shown as it is (convertLegacy turns it into an expression).
  legacy: {
    title: "Old syntax",
    readOnly: true,
    parse: (dep) => (dep.rule && !dep.expression ? { dep } : null),
    build: ({ dep }) => dep,
  },
};

const ORDER = ["legacy", "direct", "range", "thresholds", "table", "formula", "expression"];

/** The kinds a creator can pick (not the read-only old syntax). */
export const PICKABLE_KINDS = ORDER.filter((id) => !RULE_KINDS[id].readOnly);

const STRING = new Set(["fill", "stroke", "text", "src", "fontFamily", "fontWeight", "textAlign", "backgroundColor"]);
const NUMBER = new Set(["opacity", "width", "height", "angle", "scaleX", "scaleY", "left", "top", "radius", "rx", "ry", "strokeWidth", "fontSize", "skewX", "skewY"]);

/** The value type a target property takes. */
export function targetType(target) {
  if (target === "visible") return "bool";
  if (NUMBER.has(target)) return "number";
  return "string";
}

/** A propDep as a rule: always something (a raw Expression at worst). */
export function parseRule(dep) {
  for (const id of ORDER) {
    const params = RULE_KINDS[id].parse(dep);
    if (params) return { target: dep.objectProperty, source: dep.source, type: dep.type ?? targetType(dep.objectProperty), kind: id, params };
  }
  // No expression and no property: an empty Direct rule.
  return { target: dep.objectProperty, source: dep.source, type: dep.type ?? targetType(dep.objectProperty), kind: "direct", params: { property: "" } };
}

/** The propDep for a rule. */
export function buildRule({ target, source, type, kind, params }) {
  const built = RULE_KINDS[kind].build(params);
  if (kind === "legacy") return built;
  return { objectProperty: target, type: type ?? targetType(target), source, ...built };
}

/** A rule's settings when it changes to another kind: the property it reads is kept. */
export function defaultParams(kind, from = {}) {
  const property = from.property ?? "";
  switch (kind) {
    case "direct": return { property };
    case "range": return { property, from: ["0", "max"], to: ["0", "1"] };
    case "thresholds": return { property, max: "max", steps: [{ upTo: 50, value: "red" }, { upTo: 100, value: "green" }], fallback: "red" };
    case "table": return { property, entries: [{ when: "", value: "" }], other: "" };
    case "formula": return { value: "0", formula: property ? `%${property}%` : "" };
    default: return { text: property ? `%${property}%` : "" };
  }
}

/** The old dtoProperty + rule form as an expression that gives the same. */
export function convertLegacy(dep) {
  const { name, arguments: args = {} } = dep.rule ?? {};
  const names = RULE_ARG_MAPS[name];
  if (!names || !dep.dtoProperty) return null;
  const write = (key) => {
    // Old prop-refs for the target ends.
    if (key === "targetMin" && args.propTargetMin) return `%${args.propTargetMin}%`;
    if (key === "targetMax" && args.propTargetMax) return `%${args.propTargetMax}%`;
    const v = args[key];
    if (v === undefined) return "";
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  };
  const written = names.slice(1).map(write);
  while (written.length && written.at(-1) === "") written.pop();
  const { rule, dtoProperty, ...rest } = dep;
  return { ...rest, expression: `${name}(%${dtoProperty}%${written.length ? `, ${written.join(", ")}` : ""})` };
}
