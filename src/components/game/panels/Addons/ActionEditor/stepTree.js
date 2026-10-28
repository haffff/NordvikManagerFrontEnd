import UtilityHelper from "../../../../../helpers/UtilityHelper";

// An action's steps form a tree: If's Then / Else and ForEach's Do hold steps of their own.
// These work on that tree by step id. A "container" says where a list sits: null for the
// action's own steps, { parentId, block } for a block of a step.

const isStepList = (v) => Array.isArray(v) && v.every((s) => s && typeof s === "object" && "Type" in s);

// The blocks a step holds, as [name, steps] pairs.
export const blocksOf = (step) =>
  Object.entries(step?.Data ?? {}).filter(([, v]) => isStepList(v) && v.length > 0);

const mapBlocks = (step, fn) => {
  let changed = false;
  const data = { ...step.Data };
  for (const [name, value] of Object.entries(step.Data ?? {})) {
    if (!isStepList(value)) continue;
    const mapped = fn(value, name);
    if (mapped !== value) { data[name] = mapped; changed = true; }
  }
  return changed ? { ...step, Data: data } : step;
};

/** Every step gets an id (hand-written actions may have none), inside blocks too. */
export function withIds(steps) {
  return (steps ?? []).map((s) => mapBlocks(
    { ...s, id: s?.id || UtilityHelper.GenerateUUID(), Data: s?.Data ?? {} },
    (inner) => withIds(inner)));
}

/** { step, container, index, path } of the step with this id, or null. */
export function findStep(steps, id, container = null, prefix = "") {
  for (let i = 0; i < (steps ?? []).length; i++) {
    const step = steps[i];
    if (step.id === id) return { step, container, index: i, path: prefix + i };
    for (const [block, inner] of blocksOf(step)) {
      const found = findStep(inner, id, { parentId: step.id, block }, `${prefix}${i}/${block}/`);
      if (found) return found;
    }
  }
  return null;
}

export const stepPath = (steps, id) => findStep(steps, id)?.path ?? null;

/** Applies fn to the step with this id, wherever it is. */
export function updateById(steps, id, fn) {
  let changed = false;
  const out = steps.map((s) => {
    if (s.id === id) { changed = true; return fn(s); }
    const next = mapBlocks(s, (inner) => updateById(inner, id, fn));
    if (next !== s) changed = true;
    return next;
  });
  return changed ? out : steps;
}

/** The list holding a container's steps changed by fn (the action's own list for null). */
function updateList(steps, container, fn) {
  if (!container) return fn(steps);
  return updateById(steps, container.parentId, (parent) =>
    ({ ...parent, Data: { ...parent.Data, [container.block]: fn(parent.Data?.[container.block] ?? []) } }));
}

export function removeById(steps, id) {
  const found = findStep(steps, id);
  if (!found) return steps;
  return updateList(steps, found.container, (list) => list.filter((s) => s.id !== id));
}

const freshIds = (step) => mapBlocks({ ...step, id: UtilityHelper.GenerateUUID() }, (inner) => inner.map(freshIds));

/** A copy right after the step; it and the steps in its blocks get new ids. */
export function duplicateById(steps, id) {
  const found = findStep(steps, id);
  if (!found) return steps;
  const copy = freshIds(JSON.parse(JSON.stringify(found.step)));
  return updateList(steps, found.container, (list) => [...list.slice(0, found.index + 1), copy, ...list.slice(found.index + 1)]);
}

export function insertInto(steps, container, index, step) {
  return updateList(steps, container, (list) => [...list.slice(0, index), step, ...list.slice(index)]);
}

/** Moves a step to another's place, when both are in the same list. */
export function moveWithin(steps, fromId, toId) {
  const from = findStep(steps, fromId);
  const to = findStep(steps, toId);
  if (!from || !to || fromId === toId) return steps;
  const same = (from.container?.parentId ?? null) === (to.container?.parentId ?? null)
    && (from.container?.block ?? null) === (to.container?.block ?? null);
  if (!same) return steps;
  return updateList(steps, from.container, (list) => {
    const arr = [...list];
    const [item] = arr.splice(from.index, 1);
    arr.splice(to.index, 0, item);
    return arr;
  });
}

/** The steps that run before this one, in order: a step, then the steps in its blocks. */
export function stepsBefore(steps, id) {
  const out = [];
  const visit = (list) => {
    for (const step of list ?? []) {
      if (step.id === id) return true;
      out.push(step);
      for (const [, inner] of blocksOf(step)) if (visit(inner)) return true;
    }
    return false;
  };
  visit(steps);
  return out;
}
