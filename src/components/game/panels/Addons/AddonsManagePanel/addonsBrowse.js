// Searching, filtering and sorting the registry's addons for the Browse tab.

/** A category's display name, or its key when the server sent no names (older servers). */
export function categoryName(key, categories) {
  return (categories ?? []).find((c) => c.key === key)?.name || key;
}

/** The categories at least one addon uses: the registry's order, then any it doesn't name. */
export function usedCategories(repository, categories) {
  const used = new Set((repository ?? []).flatMap((a) => a.categories ?? []));
  const known = (categories ?? []).filter((c) => used.has(c.key));
  const unknown = [...used].filter((k) => !known.some((c) => c.key === k)).sort().map((key) => ({ key, name: key }));
  return [...known, ...unknown];
}

const text = (value) => String(value ?? "").toLowerCase();
const byText = (pick) => (a, b) => text(pick(a)).localeCompare(text(pick(b))) || text(a.name).localeCompare(text(b.name));

/**
 * The addons to list: `search` matches name, author, description or key; `category` is a
 * category key or "all"; `sort` is "name" (default), "author" or "category".
 */
export function browseAddons(repository, { search = "", category = "all", sort = "name" } = {}, categories = []) {
  const query = search.trim().toLowerCase();
  const list = (Array.isArray(repository) ? repository : []).filter((a) =>
    (!query || [a.name, a.author, a.description, a.key].some((v) => text(v).includes(query))) &&
    (category === "all" || (a.categories ?? []).includes(category)));

  const firstCategory = (a) => {
    const names = (a.categories ?? []).map((k) => categoryName(k, categories)).sort();
    return names[0] ?? "￿"; // uncategorised last
  };
  const compare = sort === "author" ? byText((a) => a.author || "￿")
    : sort === "category" ? byText(firstCategory)
      : byText((a) => a.name);
  return [...list].sort(compare);
}

const versionParts = (version) => {
  const parts = String(version).trim().split(/[-+]/)[0].split(".");
  return parts.every((p) => /^\d+$/.test(p)) ? parts.map(Number) : null;
};

/**
 * Whether `installed` is `required` or newer, as the server checks a dependency's version
 * (the lowest that works): part by part as numbers, ignoring a "-beta" suffix. No required
 * version accepts anything; versions that aren't numbers match only exactly.
 */
export function versionAtLeast(installed, required) {
  if (required == null || String(required).trim() === "") return true;
  if (installed == null || String(installed).trim() === "") return false;
  const have = versionParts(installed);
  const need = versionParts(required);
  if (!have || !need) return String(installed).trim() === String(required).trim();
  for (let i = 0; i < Math.max(have.length, need.length); i++) {
    const a = have[i] ?? 0;
    const b = need[i] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

/**
 * The addons installing `addon` also installs, as the server works them out: each
 * dependency (and theirs) the game lacks or has too old, deepest first, once each.
 * `update` marks one the game has in an older version. A circle stops the walk (the
 * server refuses to install it).
 */
export function alsoInstalls(addon, repository, installed) {
  const registry = Array.isArray(repository) ? repository : [];
  const inGame = Array.isArray(installed) ? installed : [];
  const result = [];
  const walk = (current, chain) => {
    for (const dependency of current?.dependencies ?? []) {
      const key = dependency?.key;
      if (!key || chain.includes(key) || result.some((r) => r.key === key)) continue;
      const have = inGame.find((x) => x.key === key);
      if (have && versionAtLeast(have.version, dependency.version)) continue;
      const entry = registry.find((x) => x.key === key);
      walk(entry, [...chain, key]);
      result.push({ key, name: entry?.name ?? key, update: !!have });
    }
  };
  walk(addon, [addon?.key]);
  return result;
}
