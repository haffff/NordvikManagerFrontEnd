// An action's hook filter: which occurrences of its hook run it. What it means depends on the
// hook, and the server says so in its hook list (HookFilters / HookMeta on the server):
//   19 Chat Command: required, the commands the action handles, e.g. "poll, vote";
//   every other hook: no filter yet.
// The editor shows the field only for a hook whose `filter` text isn't empty.

/** The filter field for this hook ({ help, required }), or null when it takes none. */
export function filterField(hook) {
  if (!hook?.filter) return null;
  return { help: hook.filter, required: Boolean(hook.filterRequired) };
}

/** What to change when the trigger changes: a hook without a filter drops it. */
export function hookChange(value, hooks, currentFilter) {
  const hook = (hooks ?? []).find((h) => Number(h.value) === Number(value));
  return { hook: Number(value), hookFilter: filterField(hook) ? currentFilter ?? "" : null };
}

/** A short hint for lists: a Chat Command action's commands, "/poll /vote". */
export function filterHint(action) {
  if (Number(action?.hook) !== 19 || !action?.hookFilter) return "";
  return action.hookFilter.split(/[\s,]+/).filter(Boolean).map((c) => `/${c.replace(/^\//, "")}`).join(" ");
}
