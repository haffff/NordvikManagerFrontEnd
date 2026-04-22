import TokenUIRules from "./TokenUIRules";

// Positional argument order for each rule function
const RULE_ARG_MAPS = {
  FromTo:     ["value", "valueMin", "valueMax", "targetMin", "targetMax"],
  Enum:       ["value", "enumObject"],
  FromToEnum: ["value", "valueMin", "valueMax", "targetMin", "targetMax", "defaultValue", "enumObject"],
  Math:       ["value", "operation"],
};

// Depth-aware comma split (respects nested parens, brackets, braces, and quoted strings)
function splitArgs(str) {
  const args = [];
  let depth = 0;
  let inStr = false;
  let strChar = "";
  let start = 0;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (ch === strChar && str[i - 1] !== "\\") inStr = false;
    } else if (ch === '"' || ch === "'") {
      inStr = true;
      strChar = ch;
    } else if (ch === "(" || ch === "[" || ch === "{") {
      depth++;
    } else if (ch === ")" || ch === "]" || ch === "}") {
      depth--;
    } else if (ch === "," && depth === 0) {
      args.push(str.slice(start, i).trim());
      start = i + 1;
    }
  }
  args.push(str.slice(start).trim());
  return args;
}

// Parse a single arg string to number, JSON, or string
function parseArgValue(s) {
  if (s === "") return undefined;
  const n = Number(s);
  if (!Number.isNaN(n)) return n;
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null") return null;
  try { return JSON.parse(s); } catch (_) {}
  // strip surrounding quotes
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

// Returns all %propName% references in an expression string
export function extractPropNames(expression) {
  if (typeof expression !== "string") return [];
  const names = [];
  const re = /%(\w+)%/g;
  let m;
  while ((m = re.exec(expression)) !== null) {
    names.push(m[1]);
  }
  return names;
}

// Returns true if a propDep uses the expression syntax
export function isExpressionDep(dep) {
  return typeof dep.expression === "string" && dep.expression.trim() !== "";
}

/**
 * Evaluate a propDep expression against a property map.
 *
 * Expression formats:
 *   "RuleName(arg1, arg2, ...)"  — rule function call; first arg is the primary value expression
 *   "%propName%"                 — plain substitution (type-coerced per dep.type)
 *   any other string             — %prop% substitution applied then type-coerced;
 *                                  arithmetic is NOT evaluated (use the Math rule for that)
 *
 * @param {string} expression
 * @param {Map<string,string>} propsMap  — property name → raw string value
 * @param {string} type                 — coercion type: "string" | "number" | "bool"
 * @returns {*} the evaluated result, or undefined on failure
 */
export function evaluate(expression, propsMap, type) {
  // Check for rule function call: RuleName(...)
  const funcMatch = expression.match(/^(\w+)\((.*)\)\s*$/s);
  if (funcMatch) {
    const ruleName = funcMatch[1];
    if (!TokenUIRules[ruleName]) {
      console.warn(`TokenExpressionEvaluator: unknown rule "${ruleName}"`);
      return undefined;
    }

    const argMap = RULE_ARG_MAPS[ruleName];
    const rawArgs = splitArgs(funcMatch[2]);

    const ruleParams = {};
    rawArgs.forEach((rawArg, i) => {
      const paramName = argMap?.[i];
      if (!paramName) return;
      // Substitute %prop% inside each arg before parsing
      const substituted = rawArg.replace(/%(\w+)%/g, (_, name) => propsMap.get(name) ?? "");
      ruleParams[paramName] = parseArgValue(substituted);
    });

    try {
      return TokenUIRules[ruleName](ruleParams);
    } catch (err) {
      console.warn(`TokenExpressionEvaluator: rule "${ruleName}" threw:`, err);
      return undefined;
    }
  }

  // Plain %prop% substitution then type coercion — no arithmetic evaluation
  const substituted = expression.replace(/%(\w+)%/g, (_, name) => propsMap.get(name) ?? "");
  return coerceValue(substituted.trim(), type);
}

function coerceValue(raw, type) {
  if (raw === undefined || raw === null) return undefined;
  switch (type) {
    case "number": {
      const n = parseFloat(raw);
      return Number.isNaN(n) ? undefined : n;
    }
    case "bool":
      if (raw === true || raw === false) return raw;
      if (typeof raw === "string") {
        const lo = raw.toLowerCase();
        if (lo === "true" || lo === "1") return true;
        if (lo === "false" || lo === "0") return false;
      }
      return undefined;
    default:
      return String(raw);
  }
}
