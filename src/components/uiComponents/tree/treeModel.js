// Pure helpers for the folder trees (materials, cards…).
//
// The server stores a tree as entries { id, parentId, isFolder, head, next, targetId, name,
// color, icon }. Siblings form a linked list through `next`; `head` marks the first one.
// A leaf points at an entity (material, card…) through `targetId`.

/**
 * Builds the displayed tree.
 * @param entries tree entries from the server
 * @param items   entities that leaves point at (by id)
 * @param options { additionalFilter?: (entity) => boolean }
 * @returns root nodes: { id, entry, isFolder, name, entity, parentId, children }
 */
export function buildTree(entries, items, options = {}) {
  const list = Array.isArray(entries) ? entries.filter((e) => e && e.id) : [];
  const entityById = new Map((items ?? []).filter(Boolean).map((x) => [x.id, x]));
  const entryById = new Map(list.map((e) => [e.id, e]));

  // Group siblings by parent; an entry whose parent is missing is shown at the top level.
  const groups = new Map();
  for (const e of list) {
    const parentKey = e.parentId && entryById.has(e.parentId) ? e.parentId : null;
    if (!groups.has(parentKey)) groups.set(parentKey, []);
    groups.get(parentKey).push(e);
  }

  const toNode = (e, parentId) => {
    if (e.isFolder) {
      return { id: e.id, entry: e, isFolder: true, name: e.name ?? "", entity: null, parentId, children: [] };
    }
    const entity = entityById.get(e.targetId);
    if (!entity) return null; // the material/card no longer exists
    if (options.additionalFilter && !options.additionalFilter(entity)) return null;
    return { id: e.id, entry: e, isFolder: false, name: entity.name ?? "", entity, parentId, children: [] };
  };

  const build = (parentKey, seenFolders) => {
    const nodes = [];
    for (const e of orderSiblings(groups.get(parentKey) ?? [])) {
      const node = toNode(e, parentKey);
      if (!node) continue;
      if (node.isFolder && !seenFolders.has(node.id)) {
        node.children = build(node.id, new Set([...seenFolders, node.id]));
      }
      nodes.push(node);
    }
    return nodes;
  };

  return build(null, new Set());
}

/**
 * Orders one sibling group by following `next` links. Chains start at entries no sibling
 * points to (an entry flagged `head` first); entries caught in a cycle are appended in
 * their original order so nothing ever disappears.
 */
export function orderSiblings(siblings) {
  const byId = new Map(siblings.map((s) => [s.id, s]));
  const pointedTo = new Set(siblings.map((s) => s.next).filter((n) => n && byId.has(n)));
  const starts = siblings
    .filter((s) => !pointedTo.has(s.id))
    .sort((a, b) => (b.head === true) - (a.head === true));

  const out = [];
  const seen = new Set();
  for (const start of starts) {
    let cur = start;
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      out.push(cur);
      cur = cur.next ? byId.get(cur.next) : null;
    }
  }
  for (const s of siblings) if (!seen.has(s.id)) out.push(s);
  return out;
}

const matches = (node, q) => node.name.toLowerCase().includes(q);

/**
 * Rows to display, in order.
 * Without a query: a folder's children show when it's in `openIds`.
 * With a query (case-insensitive): only matches and the folders leading to them are shown,
 * and those folders are opened for the search (openIds itself isn't changed). A folder whose
 * own name matches shows all of its contents.
 * @returns {{ node, depth, hasChildren, isOpen }[]}
 */
export function flattenVisible(roots, openIds, query = "") {
  const q = query.trim().toLowerCase();
  const rows = [];

  if (!q) {
    const walk = (nodes, depth) => {
      for (const node of nodes) {
        const isOpen = node.isFolder && openIds.has(node.id);
        rows.push({ node, depth, hasChildren: node.children.length > 0, isOpen });
        if (isOpen) walk(node.children, depth + 1);
      }
    };
    walk(roots, 0);
    return rows;
  }

  // Which nodes are shown when searching.
  const keep = new Set();
  const mark = (node, ancestorMatched) => {
    const self = ancestorMatched || matches(node, q);
    let any = self;
    for (const child of node.children) if (mark(child, self)) any = true;
    if (any) keep.add(node.id);
    return any;
  };
  roots.forEach((n) => mark(n, false));

  const walk = (nodes, depth) => {
    for (const node of nodes) {
      if (!keep.has(node.id)) continue;
      const visibleChildren = node.children.filter((c) => keep.has(c.id));
      const isOpen = node.isFolder && visibleChildren.length > 0;
      rows.push({ node, depth, hasChildren: node.children.length > 0, isOpen });
      if (isOpen) walk(node.children, depth + 1);
    }
  };
  walk(roots, 0);
  return rows;
}

/** Splits text into [{ text, match }] parts for highlighting a search query. */
export function splitMatch(text, query) {
  const s = String(text ?? "");
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return [{ text: s, match: false }];
  const out = [];
  const lower = s.toLowerCase();
  let i = 0;
  for (;;) {
    const at = lower.indexOf(q, i);
    if (at === -1) break;
    if (at > i) out.push({ text: s.slice(i, at), match: false });
    out.push({ text: s.slice(at, at + q.length), match: true });
    i = at + q.length;
  }
  if (i < s.length) out.push({ text: s.slice(i), match: false });
  return out;
}

const isInside = (entryById, id, ancestorId) => {
  const seen = new Set();
  let cur = entryById.get(id);
  while (cur?.parentId && !seen.has(cur.id)) {
    if (cur.parentId === ancestorId) return true;
    seen.add(cur.id);
    cur = entryById.get(cur.parentId);
  }
  return false;
};

/**
 * The `tree_update` payload that moves `dragId` relative to `targetId`, or null when the
 * move is invalid or changes nothing. The server reads `next` as "place right before this
 * entry" and `next: null` as "place last in parentId".
 * @param position "inside" | "before" | "after" | "end" (end of the top level; targetId unused)
 */
export function computeMove(entries, dragId, targetId, position) {
  const entryById = new Map((entries ?? []).map((e) => [e.id, e]));
  const drag = entryById.get(dragId);

  // Dropped on the empty space below the rows: last at the top level.
  if (position === "end") {
    if (!drag || (!drag.parentId && !drag.next)) return null;
    return { id: dragId, parentId: null, next: null };
  }

  const target = entryById.get(targetId);
  if (!drag || !target || dragId === targetId) return null;
  // A folder can't go into itself or anything inside it.
  if (drag.isFolder && isInside(entryById, targetId, dragId)) return null;

  const parentId = target.parentId ?? null;

  switch (position) {
    case "inside":
      if (!target.isFolder) return null;
      if (drag.parentId === target.id && !drag.next) return null; // already last in it
      return { id: dragId, parentId: target.id, next: null };
    case "before":
      if ((drag.parentId ?? null) === parentId && drag.next === target.id) return null;
      return { id: dragId, parentId, next: target.id };
    case "after":
      if (target.next === dragId) return null;
      return { id: dragId, parentId, next: target.next ?? null };
    default:
      return null;
  }
}

/**
 * Everything inside a folder, children before their folder (safe deletion order).
 * The folder itself isn't included.
 */
export function collectDescendants(folderId, entries) {
  const childrenOf = new Map();
  for (const e of entries ?? []) {
    if (!e.parentId) continue;
    if (!childrenOf.has(e.parentId)) childrenOf.set(e.parentId, []);
    childrenOf.get(e.parentId).push(e);
  }
  const result = [];
  const seen = new Set();
  const walk = (parentId) => {
    for (const child of childrenOf.get(parentId) ?? []) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      if (child.isFolder) walk(child.id);
      result.push(child);
    }
  };
  walk(folderId);
  return result;
}

/** Folder path like "Maps/Dungeons/" for an entry, from its parents. */
export function entryPath(entryId, entries) {
  const byId = new Map((entries ?? []).map((e) => [e.id, e]));
  const parts = [];
  const seen = new Set();
  let cur = byId.get(byId.get(entryId)?.parentId);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    parts.unshift(cur.name ?? "");
    cur = byId.get(cur.parentId);
  }
  return parts.length ? parts.join("/") + "/" : "";
}
