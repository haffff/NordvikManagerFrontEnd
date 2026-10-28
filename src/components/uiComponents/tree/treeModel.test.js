import { describe, it, expect } from "vitest";
import {
  buildTree, orderSiblings, flattenVisible, splitMatch, computeMove, computeMoveMany, collectDescendants, entryPath, selectWithModifiers, withAddRows,
} from "./treeModel";

// Root: [Maps(folder) → goblin] ; Maps: [dungeon → forest] ; Maps/Deep(folder) inside Maps after forest
const entries = [
  { id: "maps", isFolder: true, name: "Maps", head: true, next: "e-goblin", parentId: null },
  { id: "e-goblin", targetId: "goblin", next: null, parentId: null },
  { id: "e-dungeon", targetId: "dungeon", head: true, next: "e-forest", parentId: "maps" },
  { id: "e-forest", targetId: "forest", next: "deep", parentId: "maps" },
  { id: "deep", isFolder: true, name: "Deep", next: null, parentId: "maps" },
  { id: "e-crypt", targetId: "crypt", head: true, next: null, parentId: "deep" },
];
const items = [
  { id: "goblin", name: "Goblin" }, { id: "dungeon", name: "Dungeon Map" },
  { id: "forest", name: "Forest" }, { id: "crypt", name: "Crypt map" },
];

const names = (rows) => rows.map((r) => `${"  ".repeat(r.depth)}${r.node.name}`);

describe("orderSiblings", () => {
  it("follows next links from the head", () => {
    const s = [{ id: "c", next: null }, { id: "a", head: true, next: "b" }, { id: "b", next: "c" }];
    expect(orderSiblings(s).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps several chains, head chain first", () => {
    const s = [{ id: "x", next: "y" }, { id: "y" }, { id: "a", head: true, next: "b" }, { id: "b" }];
    expect(orderSiblings(s).map((x) => x.id)).toEqual(["a", "b", "x", "y"]);
  });

  it("never loses entries caught in a cycle", () => {
    const s = [{ id: "a", next: "b" }, { id: "b", next: "a" }, { id: "c" }];
    expect(orderSiblings(s).map((x) => x.id).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("buildTree", () => {
  const roots = buildTree(entries, items);

  it("nests folders and orders siblings", () => {
    expect(roots.map((n) => n.name)).toEqual(["Maps", "Goblin"]);
    expect(roots[0].children.map((n) => n.name)).toEqual(["Dungeon Map", "Forest", "Deep"]);
    expect(roots[0].children[2].children.map((n) => n.name)).toEqual(["Crypt map"]);
  });

  it("drops leaves whose entity is gone, keeps folders", () => {
    const r = buildTree(entries, [{ id: "goblin", name: "Goblin" }]);
    expect(r.map((n) => n.name)).toEqual(["Maps", "Goblin"]);
    expect(r[0].children.map((n) => n.name)).toEqual(["Deep"]);
  });

  it("shows entries with a missing parent at the top level", () => {
    const r = buildTree([{ id: "e1", targetId: "goblin", parentId: "nope" }], items);
    expect(r.map((n) => n.name)).toEqual(["Goblin"]);
  });

  it("applies additionalFilter to leaves", () => {
    const r = buildTree(entries, items, { additionalFilter: (e) => e.id !== "forest" });
    expect(r[0].children.map((n) => n.name)).toEqual(["Dungeon Map", "Deep"]);
  });

  // For whoever can't edit folders (a player): a folder with nothing they see in it is clutter.
  it("hideEmptyFolders leaves out folders with nothing shown inside, at any depth", () => {
    const r = buildTree(entries, [{ id: "goblin", name: "Goblin" }], { hideEmptyFolders: true });
    expect(r.map((n) => n.name)).toEqual(["Goblin"]);

    const deepOnly = buildTree(entries, [{ id: "crypt", name: "Crypt map" }], { hideEmptyFolders: true });
    expect(deepOnly.map((n) => n.name)).toEqual(["Maps"]);
    expect(deepOnly[0].children.map((n) => n.name)).toEqual(["Deep"]);
    expect(deepOnly[0].children[0].children.map((n) => n.name)).toEqual(["Crypt map"]);
  });

  it("hideEmptyFolders counts what additionalFilter leaves out as not shown", () => {
    const r = buildTree(entries, [{ id: "goblin", name: "Goblin" }, { id: "crypt", name: "Crypt map" }],
      { hideEmptyFolders: true, additionalFilter: (e) => e.id !== "crypt" });
    expect(r.map((n) => n.name)).toEqual(["Goblin"]);
  });

  it("survives a folder that is its own ancestor", () => {
    const loop = [{ id: "f", isFolder: true, name: "F", parentId: "g" }, { id: "g", isFolder: true, name: "G", parentId: "f" }];
    expect(() => buildTree(loop, [])).not.toThrow();
  });
});

describe("flattenVisible", () => {
  const roots = buildTree(entries, items);

  it("shows children of open folders only", () => {
    expect(names(flattenVisible(roots, new Set()))).toEqual(["Maps", "Goblin"]);
    expect(names(flattenVisible(roots, new Set(["maps"])))).toEqual(
      ["Maps", "  Dungeon Map", "  Forest", "  Deep", "Goblin"]);
  });

  it("search is case-insensitive and opens folders that contain matches", () => {
    const rows = flattenVisible(roots, new Set(), "MAP");
    expect(names(rows)).toEqual(["Maps", "  Dungeon Map", "  Forest", "  Deep", "    Crypt map"]);
  });

  it("search shows only matches and their folders", () => {
    expect(names(flattenVisible(roots, new Set(), "crypt"))).toEqual(["Maps", "  Deep", "    Crypt map"]);
    expect(names(flattenVisible(roots, new Set(), "zzz"))).toEqual([]);
  });

  it("does not change the open set while searching", () => {
    const open = new Set();
    flattenVisible(roots, open, "crypt");
    expect(open.size).toBe(0);
  });
});

describe("splitMatch", () => {
  it("marks every case-insensitive match", () => {
    expect(splitMatch("Map of maps", "map")).toEqual([
      { text: "Map", match: true }, { text: " of ", match: false },
      { text: "map", match: true }, { text: "s", match: false },
    ]);
    expect(splitMatch("abc", "")).toEqual([{ text: "abc", match: false }]);
  });
});

describe("computeMove", () => {
  it("inside a folder appends at its end", () => {
    expect(computeMove(entries, "e-goblin", "deep", "inside")).toEqual({ id: "e-goblin", parentId: "deep", next: null });
  });

  it("before an entry places it right before", () => {
    expect(computeMove(entries, "e-goblin", "e-dungeon", "before")).toEqual({ id: "e-goblin", parentId: "maps", next: "e-dungeon" });
  });

  it("after an entry places it before that entry's successor (or last)", () => {
    expect(computeMove(entries, "e-goblin", "e-dungeon", "after")).toEqual({ id: "e-goblin", parentId: "maps", next: "e-forest" });
    expect(computeMove(entries, "e-goblin", "deep", "after")).toEqual({ id: "e-goblin", parentId: "maps", next: null });
  });

  it("'end' moves to the end of the top level", () => {
    expect(computeMove(entries, "e-crypt", null, "end")).toEqual({ id: "e-crypt", parentId: null, next: null });
    expect(computeMove(entries, "e-goblin", null, "end")).toBeNull(); // already last at top level
  });

  it("moves a folder up a level", () => {
    expect(computeMove(entries, "deep", "maps", "after")).toEqual({ id: "deep", parentId: null, next: "e-goblin" });
  });

  it("rejects moves that change nothing or are impossible", () => {
    expect(computeMove(entries, "e-dungeon", "e-dungeon", "after")).toBeNull();
    expect(computeMove(entries, "e-forest", "e-dungeon", "after")).toBeNull();   // already after
    expect(computeMove(entries, "e-dungeon", "e-forest", "before")).toBeNull();  // already before
    expect(computeMove(entries, "e-goblin", "e-forest", "inside")).toBeNull();   // not a folder
    expect(computeMove(entries, "maps", "deep", "inside")).toBeNull();           // into its own subfolder
    expect(computeMove(entries, "maps", "e-crypt", "before")).toBeNull();        // into its own subtree
    expect(computeMove(entries, "e-crypt", "deep", "inside")).toBeNull();        // already last there
  });
});

describe("collectDescendants / entryPath", () => {
  it("lists children before their folder", () => {
    expect(collectDescendants("maps", entries).map((e) => e.id)).toEqual(["e-dungeon", "e-forest", "e-crypt", "deep"]);
  });

  it("builds a folder path", () => {
    expect(entryPath("e-crypt", entries)).toBe("Maps/Deep/");
    expect(entryPath("e-goblin", entries)).toBe("");
  });
});

// Ctrl (⌘) toggles one row, Shift selects the rows from the anchor (the last plain or
// Ctrl click) to the clicked one, Ctrl+Shift adds that range to what's selected.
describe("selectWithModifiers", () => {
  const order = ["a", "b", "c", "d", "e"];
  const sel = (ids, anchorId) => ({ ids: new Set(ids), anchorId });
  const ids = (s) => [...s.ids].sort();

  it("Ctrl adds a row and takes it off again", () => {
    let s = selectWithModifiers(order, sel(["b"], "b"), "d", { toggle: true });
    expect(ids(s)).toEqual(["b", "d"]);
    expect(s.anchorId).toBe("d");
    s = selectWithModifiers(order, s, "b", { toggle: true });
    expect(ids(s)).toEqual(["d"]);
  });

  it("Shift selects the range from the anchor, in either direction", () => {
    expect(ids(selectWithModifiers(order, sel(["b"], "b"), "d", { range: true }))).toEqual(["b", "c", "d"]);
    expect(ids(selectWithModifiers(order, sel(["d"], "d"), "a", { range: true }))).toEqual(["a", "b", "c", "d"]);
  });

  it("Shift replaces the selection with the range and keeps the anchor", () => {
    const s = selectWithModifiers(order, sel(["a", "e"], "b"), "c", { range: true });
    expect(ids(s)).toEqual(["b", "c"]);
    expect(s.anchorId).toBe("b");
  });

  it("Ctrl+Shift adds the range to the selection", () => {
    expect(ids(selectWithModifiers(order, sel(["e"], "a"), "b", { toggle: true, range: true }))).toEqual(["a", "b", "e"]);
  });

  it("Shift without an anchor in view selects just the row", () => {
    expect(ids(selectWithModifiers(order, sel([], null), "c", { range: true }))).toEqual(["c"]);
  });
});

// Dragging one of several selected rows moves them all, in tree order, to the drop point.
describe("computeMoveMany", () => {
  // Root: maps(folder) → goblin ; maps: dungeon → forest → deep(folder) ; deep: crypt
  it("puts them before the target, in order", () => {
    expect(computeMoveMany(entries, ["e-dungeon", "e-goblin"], "e-forest", "before")).toEqual([
      { id: "e-dungeon", parentId: "maps", next: "e-forest" },
      { id: "e-goblin", parentId: "maps", next: "e-forest" },
    ]);
  });

  it("puts them after the target, before the first unmoved row that follows it", () => {
    expect(computeMoveMany(entries, ["e-goblin", "deep"], "e-dungeon", "after")).toEqual([
      { id: "e-goblin", parentId: "maps", next: "e-forest" },
      { id: "deep", parentId: "maps", next: "e-forest" },
    ]);
    // e-forest itself is moved: the next unmoved one after it.
    expect(computeMoveMany(entries, ["e-forest", "e-goblin"], "e-dungeon", "after")).toEqual([
      { id: "e-forest", parentId: "maps", next: "deep" },
      { id: "e-goblin", parentId: "maps", next: "deep" },
    ]);
  });

  it("puts them last inside a folder, or last at the top level", () => {
    expect(computeMoveMany(entries, ["e-goblin", "e-dungeon"], "deep", "inside")).toEqual([
      { id: "e-goblin", parentId: "deep", next: null },
      { id: "e-dungeon", parentId: "deep", next: null },
    ]);
    expect(computeMoveMany(entries, ["e-dungeon", "e-crypt"], null, "end")).toEqual([
      { id: "e-dungeon", parentId: null, next: null },
      { id: "e-crypt", parentId: null, next: null },
    ]);
  });

  it("moves a folder with what's in it: rows inside a moved folder aren't moved on their own", () => {
    expect(computeMoveMany(entries, ["deep", "e-crypt"], "e-goblin", "after")).toEqual([
      { id: "deep", parentId: null, next: null },
    ]);
  });

  it("does nothing when dropped on one of the moved rows, or a folder into itself", () => {
    expect(computeMoveMany(entries, ["e-goblin", "e-forest"], "e-forest", "before")).toEqual([]);
    expect(computeMoveMany(entries, ["maps", "e-goblin"], "deep", "inside")).toEqual([]);
  });
});

// A greyed "+ New … here" row closes every open folder, and the top level.
describe("withAddRows", () => {
  const row = (id, depth, isOpen = false) => ({ node: { id, isFolder: isOpen || id.startsWith("f") }, depth, isOpen });
  const shape = (rows) => rows.map((r) => (r.add ? `+${r.parentId ?? "top"}@${r.depth}` : `${r.node.id}@${r.depth}`));

  it("ends each open folder and the top level with one", () => {
    const rows = [row("fA", 0, true), row("a1", 1), row("fB", 1, true), row("b1", 2), row("a2", 1), row("fC", 0), row("x", 0)];

    expect(shape(withAddRows(rows))).toEqual([
      "fA@0", "a1@1", "fB@1", "b1@2", "+fB@2", "a2@1", "+fA@1", "fC@0", "x@0", "+top@0",
    ]);
  });

  it("gives an open but empty folder its row too", () => {
    expect(shape(withAddRows([row("fA", 0, true)]))).toEqual(["fA@0", "+fA@1", "+top@0"]);
    expect(shape(withAddRows([]))).toEqual(["+top@0"]);
  });

  it("closes nested folders that end together", () => {
    const rows = [row("fA", 0, true), row("fB", 1, true), row("b1", 2)];

    expect(shape(withAddRows(rows))).toEqual(["fA@0", "fB@1", "b1@2", "+fB@2", "+fA@1", "+top@0"]);
  });

  it("keys them apart from the entries", () => {
    expect(withAddRows([row("fA", 0, true)]).filter((r) => r.add).map((r) => r.key)).toEqual(["add:fA", "add:"]);
  });
});
