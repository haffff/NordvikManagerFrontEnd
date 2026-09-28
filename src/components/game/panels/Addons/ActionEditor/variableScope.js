// Works out which variables exist at each step of an action, for autocomplete and hints.
//
// Sources, in the order the backend fills them:
//   built-ins      set for every action (ActionProcessingService.ExecActionAsync)
//   hook           the trigger's variables (HookInfoDto.Variables)
//   steps          arguments marked isOutput (e.g. Output, ItemName), "Assign Variables"
//                  lines, and RunScript `return { a, b }` keys
// "Inputs" are names used somewhere but never defined before use: for an action called
// by name they are its arguments (e.g. %cardId%), not mistakes.

export const BUILTIN_VARIABLES = [
  "gameId", "gmId", "actionId", "actionName", "actionPrefix",
  "playerId", "playerName", "playerColor", "playerIsOwner",
];

// Names referenced by tokens: %name%, %dto:name%, %v:name.path%, %q:{name}.prop%.
export function extractVariableRefs(text) {
  if (typeof text !== "string" || !text.includes("%")) return [];
  const names = [];
  const add = (n) => { if (n && !names.includes(n)) names.push(n); };
  for (const m of text.matchAll(/%(?:dto:)?([A-Za-z_]\w*)%/g)) add(m[1]);
  for (const m of text.matchAll(/%v:([A-Za-z_]\w*)[.[]/g)) add(m[1]);
  for (const m of text.matchAll(/%q:\{([A-Za-z_]\w*)\}/g)) add(m[1]);
  return names;
}

const isPlainName = (v) => typeof v === "string" && /^[A-Za-z_]\w*$/.test(v.trim());

// Keys of object literals returned by a script: `return { total, hp: x }` → ["total", "hp"].
export function scriptReturnKeys(script) {
  if (typeof script !== "string") return [];
  const keys = [];
  for (const m of script.matchAll(/return\s*\{([^{}]*)\}/g)) {
    for (const part of m[1].split(",")) {
      const key = part.split(":")[0].trim().replace(/^["']|["']$/g, "");
      if (/^[A-Za-z_]\w*$/.test(key) && !keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

// Variables a single step defines once it has run.
export function variablesDefinedBy(step, def) {
  const data = step?.Data ?? {};
  const out = [];
  const add = (n) => { if (n && !out.includes(n)) out.push(n); };

  for (const arg of def?.arguments ?? []) {
    if (arg.isOutput && isPlainName(data[arg.name])) add(data[arg.name].trim());
  }

  if (step?.Type === "QueryData" && typeof data.Assignments === "string") {
    for (const line of data.Assignments.split(/\r?\n/)) {
      const eq = line.indexOf("=");
      if (eq > 0) { const n = line.slice(0, eq).trim(); if (isPlainName(n)) add(n); }
    }
  }

  if (step?.Type === "RunScript" && isPlainName(data.Output) === false) {
    scriptReturnKeys(data.Script).forEach(add);
  }
  return out;
}

// Every variable reference in a step's arguments (deferred args included: RunScript's
// Script reads `vars`, not tokens, so it is skipped).
export function variablesUsedBy(step, def) {
  const data = step?.Data ?? {};
  const skip = new Set((def?.arguments ?? []).filter((a) => a.type === "code").map((a) => a.name));
  const out = [];
  for (const [key, value] of Object.entries(data)) {
    if (skip.has(key) || key === "Label" || key === "Comment") continue;
    for (const n of extractVariableRefs(typeof value === "string" ? value : "")) if (!out.includes(n)) out.push(n);
  }
  return out;
}

/**
 * Variables available when step `index` runs.
 * @returns {{name:string, source:'builtin'|'hook'|'input'|'step', stepIndex?:number}[]}
 */
export function variablesAvailableAt(steps, index, defsByType, hookVariables = [], inputs = []) {
  const seen = new Map();
  const add = (name, source, stepIndex) => { if (!seen.has(name)) seen.set(name, { name, source, stepIndex }); };
  BUILTIN_VARIABLES.forEach((n) => add(n, "builtin"));
  hookVariables.forEach((n) => add(n, "hook"));
  inputs.forEach((n) => add(n, "input"));
  steps.slice(0, index).forEach((s, i) => variablesDefinedBy(s, defsByType[s.Type]).forEach((n) => add(n, "step", i)));
  return [...seen.values()];
}

// Names used before (or without) being defined — the action's arguments when called by name.
export function computeInputs(steps, defsByType, hookVariables = []) {
  const known = new Set([...BUILTIN_VARIABLES, ...hookVariables]);
  const inputs = [];
  steps.forEach((s) => {
    const def = defsByType[s.Type];
    variablesUsedBy(s, def).forEach((n) => {
      if (!known.has(n) && !inputs.includes(n)) inputs.push(n);
    });
    variablesDefinedBy(s, def).forEach((n) => known.add(n));
  });
  return inputs;
}
