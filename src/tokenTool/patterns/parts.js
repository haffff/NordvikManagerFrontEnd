import { PATTERNS } from "./index";
import { nameOfAdditions } from "./common";

// A token file as a list of parts the editor can add, remove, reorder and edit. A file's
// additions are cut into runs where their visibility switch (tokenData.maskGroup) changes,
// and each run is recognised as patterns (with their settings) or kept as custom parts.
// The switch is only a part's setting: a part on none (always shown) is still a pattern. A part keeps its own additions until its
// settings change, so a file comes back exactly as it was unless something was edited.

let lastId = 0;
const newId = () => `part-${++lastId}`;

const built = (pattern, params) => {
  const { additions, assignableIcons = [] } = PATTERNS[pattern].build(params);
  return { additions, assignableIcons };
};

const CUSTOM_COST = 100; // per addition no pattern knows: any recognised part is better

// ── A part's own rules ───────────────────────────────────────────────────────
// A pattern sets some object properties itself (its `writes`: a label's text, a bar's
// width and fill…). Any other rule (propDep) on a part is the part's own: the same on
// every addition, kept apart from the pattern's so a rebuild keeps it.

const depsOf = (a) => a.tokenData?.propDeps ?? [];
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

/** The rules every one of these additions has, in the first one's order. */
const sharedRules = (additions) =>
  depsOf(additions[0] ?? {}).filter((dep) => additions.every((a) => depsOf(a).some((d) => same(d, dep))));

/** The additions with only the deps the pattern sets, and the rest if all share them (else null). */
function ownDeps(pattern, additions) {
  const writes = new Set(pattern.writes ?? []);
  const extras = additions.map((a) => depsOf(a).filter((d) => !writes.has(d.objectProperty)));
  if (extras.some((e) => !same(e, extras[0]))) return null;
  const stripped = additions.map((a) => {
    if (!a.tokenData?.propDeps) return a;
    const own = a.tokenData.propDeps.filter((d) => writes.has(d.objectProperty));
    const { propDeps, ...rest } = a.tokenData;
    return { ...a, tokenData: own.length ? { ...rest, propDeps: own } : rest };
  });
  return { stripped, rules: extras[0] ?? [] };
}

const customPart = (additions) => ({ id: newId(), pattern: "custom", additions, assignableIcons: [], rules: sharedRules(additions) });

/** A recognised part, with the icons of the file's picker it offers and its own rules. */
function patternPart(pattern, params, additions, icons, rules = []) {
  const offered = params.inPicker
    ? params.icons.map((icon) => icons.find((i) => i.dtoProperty === icon.property && i.source === params.source)).filter(Boolean)
    : [];
  return { id: newId(), pattern: pattern.id, params: { ...params, name: params.name ?? nameOfAdditions(additions) }, additions, assignableIcons: offered, rules };
}

/**
 * One run of additions on the same switch (or on none) as parts: the fewest patterns that cover it, anything
 * no pattern knows kept as custom parts (a group can hold several parts, e.g. an HP bar
 * and the HP as text).
 */
function segment(list, icons) {
  const context = { assignableIcons: icons };
  // A pattern sees only the rules it sets; the rest must be the same on every addition.
  const matchOf = (slice) => {
    for (const pattern of Object.values(PATTERNS)) {
      const own = ownDeps(pattern, slice);
      const params = own && pattern.match(own.stripped, context);
      if (params) return { pattern, params, rules: own.rules };
    }
    return null;
  };
  // Usually the whole run is one part: nothing beats that.
  const whole = matchOf(list);
  if (whole) return [patternPart(whole.pattern, whole.params, list, icons, whole.rules)];

  const n = list.length;
  const best = Array(n + 1).fill(null);
  best[n] = { cost: 0, segments: [] };
  for (let i = n - 1; i >= 0; i--) {
    let choice = { cost: CUSTOM_COST + best[i + 1].cost, segments: [{ custom: true, from: i, to: i + 1 }, ...best[i + 1].segments] };
    for (let j = i + 1; j <= n; j++) {
      const found = matchOf(list.slice(i, j));
      if (found && 1 + best[j].cost < choice.cost) {
        choice = { cost: 1 + best[j].cost, segments: [{ ...found, from: i, to: j }, ...best[j].segments] };
      }
    }
    best[i] = choice;
  }

  // Next to each other, what no pattern knows is one custom part.
  const parts = [];
  for (const seg of best[0].segments) {
    const additions = list.slice(seg.from, seg.to);
    if (!seg.custom) parts.push(patternPart(seg.pattern, seg.params, additions, icons, seg.rules));
    else if (parts.at(-1)?.pattern === "custom") parts.push(customPart([...parts.pop().additions, ...additions]));
    else parts.push(customPart(additions));
  }
  return parts;
}

/** @returns {{ base, parts }}; base is the file without its parts (and the icons they offer) */
export function splitParts(definition) {
  const { additions = [], assignableIcons, ...rest } = definition;
  const icons = assignableIcons ?? [];

  // Runs of additions on the same switch (or on none), in the file's order (its drawing
  // order). A run can hold several parts: segment tells them apart by pattern.
  const runs = [];
  for (const addition of additions) {
    const group = addition.tokenData?.maskGroup;
    const last = runs.at(-1);
    if (last && last.group === group) last.list.push(addition);
    else runs.push({ group, list: [addition] });
  }
  const parts = runs.flatMap(({ list }) => segment(list, icons));

  const owned = new Set(parts.flatMap((p) => p.assignableIcons));
  const base = { ...rest, ...(assignableIcons ? { assignableIcons: icons.filter((i) => !owned.has(i)) } : {}) };
  return { base, parts };
}

/** The token file for these parts, in their order. */
export function joinParts(base, parts) {
  const offered = parts.flatMap((p) => p.assignableIcons ?? []);
  const icons = [...(base.assignableIcons ?? []), ...offered];
  return {
    ...base,
    ...(base.assignableIcons || icons.length ? { assignableIcons: icons } : {}),
    additions: uniqueNames(parts.flatMap((p) => p.additions)),
  };
}

// Parts moved into one group can make the same name twice (an icon set names new icons
// <group>_<id>): a later one gets a number.
function uniqueNames(additions) {
  const taken = new Set(additions.map((a) => a.name));
  const seen = new Set();
  return additions.map((a) => {
    if (!seen.has(a.name)) {
      seen.add(a.name);
      return a;
    }
    let n = 2;
    while (taken.has(`${a.name}_${n}`)) n++;
    const name = `${a.name}_${n}`;
    taken.add(name);
    seen.add(name);
    return { ...a, name };
  });
}

// ── Names ────────────────────────────────────────────────────────────────────

/** A part's own name: the stem of its additions' names (not its switch's label). */
export const nameOfPart = (part) => part.params?.name ?? nameOfAdditions(part.additions) ?? part.pattern;

/** The part renamed: its additions' names get the new stem (hp_bar_bg → health_bg). */
export function renamePart(part, name) {
  const old = nameOfPart(part);
  const rename = (n) => (n === old ? name : n?.startsWith(`${old}_`) ? `${name}${n.slice(old.length)}` : n);
  return {
    ...part,
    ...(part.params ? { params: { ...part.params, name } } : {}),
    additions: part.additions.map((a) => ({ ...a, name: rename(a.name) })),
  };
}

// ── Visibility switches (tokenData.maskGroup + label) ────────────────────────

const keyOfPart = (part) => (part.params ? part.params.group : part.additions[0]?.tokenData?.maskGroup);
const labelOfPart = (part) => (part.params ? part.params.label : part.additions[0]?.tokenData?.label);

/** A mask group key: it becomes the property names mask_<key>_enabled / _gmonly. */
export const isGroupKey = (key) => /^[A-Za-z0-9_]+$/.test(key ?? "");

/**
 * The mask groups the parts are in, in order: key, label (the first part's, as a game
 * shows the first one) and the indexes of their parts.
 */
export function groupsOf(parts) {
  const groups = [];
  parts.forEach((part, i) => {
    const key = keyOfPart(part);
    if (!key) return;
    let group = groups.find((g) => g.key === key);
    if (!group) groups.push((group = { key, label: labelOfPart(part) ?? key, parts: [] }));
    group.parts.push(i);
  });
  return groups;
}

/** The part on another switch (every addition gets its key and label), or (null) on none: always shown. */
export function setPartGroup(part, target) {
  const group = target?.group || undefined;
  const label = group ? target.label ?? group : undefined;
  if (part.params) return updatePart(part, { ...part.params, group, label });
  return {
    ...part,
    additions: part.additions.map((a) => {
      const { maskGroup, label: oldLabel, ...rest } = a.tokenData ?? {};
      return { ...a, tokenData: group ? { ...rest, maskGroup: group, label } : rest };
    }),
  };
}

/** A group's new key and label, on all its parts. */
export function renameGroup(parts, from, { key, label }) {
  return parts.map((p) => (keyOfPart(p) === from ? setPartGroup(p, { group: key, label }) : p));
}

/** A group key no part uses yet, from a stem. */
export function freeGroupKey(parts, stem = "group") {
  const used = new Set(parts.map(keyOfPart).filter(Boolean));
  let key = stem;
  for (let n = 2; used.has(key); n++) key = `${stem}${n}`;
  return key;
}

const groupsIn = (parts) => new Set(parts.flatMap((p) => [p.params?.group, ...p.additions.map((a) => a.tokenData?.maskGroup)]).filter(Boolean));

/** Adds a new part of a pattern: a name no part or switch uses, and its own switch by that name. */
export function addPart(parts, pattern) {
  const used = [
    ...groupsIn(parts),
    ...parts.map(nameOfPart),
    ...parts.flatMap((p) => p.additions.map((a) => a.name)),
  ].filter(Boolean);
  const taken = (name) => used.some((u) => u === name || u.startsWith(`${name}_`));
  const stem = pattern.toLowerCase();
  let name = stem;
  for (let n = 2; taken(name); n++) name = `${stem}${n}`;
  const params = PATTERNS[pattern].create({ group: name, name });
  return [...parts, { id: newId(), pattern, params, ...built(pattern, params), rules: [] }];
}

/** The part with new settings: its additions (and offered icons) built again, its own rules kept. */
export function updatePart(part, params) {
  const fresh = built(part.pattern, params);
  const pairs = (PATTERNS[part.pattern].pair ?? pairByPosition)(part.additions ?? [], fresh.additions);
  // Which of scale and rotation this pattern has as settings (icons: rotation only).
  const transforms = { angle: 0, ...("scale" in params ? { scaleX: 1, scaleY: 1 } : {}) };
  const rules = part.rules ?? [];
  return { ...part, params, ...fresh, additions: pairs.map(([made, original]) => withRules(overlay(original, made, transforms), made, rules)) };
}

/** The addition with the pattern's deps (from what it built) followed by the part's own rules. */
function withRules(addition, made, rules) {
  const deps = [...(made.tokenData?.propDeps ?? []), ...rules];
  const { propDeps, ...rest } = addition.tokenData ?? {};
  return { ...addition, tokenData: deps.length ? { ...rest, propDeps: deps } : rest };
}

const hasVisibleRule = (rules) => rules.some((d) => d.objectProperty === "visible");

/**
 * The part with these rules of its own, on every addition: a pattern's are kept (they're
 * rebuilt), a custom part's that not all its additions share stay where they are. A rule
 * on visible starts it hidden, as the game does; taking the last away shows it again
 * (unless its pattern hides it itself).
 */
export function setPartRules(part, rules) {
  const old = part.rules ?? [];
  let next;
  if (part.params) next = updatePart({ ...part, rules }, part.params);
  else {
    next = {
      ...part,
      rules,
      additions: part.additions.map((a) => {
        const kept = depsOf(a).filter((d) => !old.some((o) => same(o, d)));
        return withRules(a, { tokenData: { propDeps: kept } }, rules);
      }),
    };
  }
  const [had, has] = [hasVisibleRule(old), hasVisibleRule(rules)];
  if (had === has) return next;
  const madeHidden = part.params ? built(part.pattern, part.params).additions.map((a) => a.visible === false) : [];
  return {
    ...next,
    additions: next.additions.map((a, i) => {
      if (has) return { ...a, visible: false };
      if (madeHidden[i]) return a;
      const { visible, ...rest } = a;
      return rest;
    }),
  };
}

// Which additions the part's pattern makes hidden itself (a button until selected).
const hiddenByPattern = (part) => (part.params ? built(part.pattern, part.params).additions.map((a) => a.visible === false) : []);

/** An addition with these deps; a first visible rule starts it hidden, the last one gone shows it. */
function withDeps(addition, deps, keepHidden) {
  const [had, has] = [hasVisibleRule(depsOf(addition)), hasVisibleRule(deps)];
  const { propDeps, ...rest } = addition.tokenData ?? {};
  const next = { ...addition, tokenData: deps.length ? { ...rest, propDeps: deps } : rest };
  if (has && !had) return { ...next, visible: false };
  if (had && !has && !keepHidden) {
    const { visible, ...shown } = next;
    return shown;
  }
  return next;
}

/**
 * A part's rules for the editor: the ones all its additions have, and each addition's
 * others (with one addition, all of them are its own). The pattern's rules are rules
 * like any other: the file is read again, so the part stays what it is if its pattern
 * still makes them, and becomes a custom part (nothing lost) if not.
 */
export function rulesOfPart(part) {
  const shared = part.additions.length > 1 ? sharedRules(part.additions) : [];
  return { shared, own: part.additions.map((a) => depsOf(a).filter((d) => !shared.some((r) => same(r, d)))) };
}

/** The part with these rules on every one of its additions, after each one's own. */
export function setSharedRules(part, rules) {
  const { own } = rulesOfPart(part);
  const hidden = hiddenByPattern(part);
  return { ...part, additions: part.additions.map((a, i) => withDeps(a, [...own[i], ...rules], hidden[i])) };
}

/** The part with one addition's rules (all of them, the shared ones too) as given. */
export function setAdditionRules(part, index, deps) {
  const hidden = hiddenByPattern(part);
  return { ...part, additions: part.additions.map((a, i) => (i === index ? withDeps(a, deps, hidden[i]) : a)) };
}

// What every pattern decides in a part's tokenData; anything else there is the file's.
const MODELLED = ["anchor", "offsetX", "offsetY", "maskGroup", "label", "propDeps", "showOnTokenControl", "fitToToken"];

const pairByPosition = (originals, made) => made.map((m, i) => [m, originals.length === made.length ? originals[i] : null]);

/**
 * A rebuilt part laid over the file's: the pattern's fields win, the file keeps its name,
 * its type (e.g. an editable i-text label) and everything the pattern doesn't model.
 */
function overlay(original, made, transforms = {}) {
  if (!original) return made;
  const tokenData = { ...(original.tokenData ?? {}) };
  for (const key of MODELLED) {
    if (key in made.tokenData) tokenData[key] = made.tokenData[key];
    else delete tokenData[key];
  }
  // Only onClick is a setting; other events (onHover, ...) are the file's.
  if (made.tokenData.actions) tokenData.actions = { ...(original.tokenData?.actions ?? {}), ...made.tokenData.actions };
  const result = { ...original, ...made, name: original.name, type: original.type, tokenData };
  // Scale and rotation set back to none (not written): the file's own value doesn't stay.
  for (const [key, none] of Object.entries(transforms)) {
    if (!(key in made) && key in original && original[key] !== none) result[key] = none;
  }
  return result;
}

/**
 * The parts with part i moved onto switch `key` (its key and label), onto a new one of its
 * own named after the part (""), or onto none (null): always shown.
 */
export function movePartToGroup(parts, i, key) {
  const part = parts[i];
  if (key === null) return parts.map((p, j) => (j === i ? setPartGroup(p, null) : p));
  let target;
  if (key) target = groupsOf(parts).find((g) => g.key === key);
  else {
    const name = nameOfPart(part);
    const stem = (name ?? "").replace(/[^A-Za-z0-9_]/g, "_") || "switch";
    target = { key: freeGroupKey(parts, stem), label: name || stem };
  }
  if (!target) return parts;
  return parts.map((p, j) => (j === i ? setPartGroup(p, { group: target.key, label: target.label }) : p));
}

/** Switch `key` removed: its parts are on none (always shown). */
export function removeGroup(parts, key) {
  return parts.map((p) => (keyOfPart(p) === key ? setPartGroup(p, null) : p));
}
