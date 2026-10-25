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
