import { describe, it, expect } from "vitest";
import {
  buildTree, orderSiblings, flattenVisible, splitMatch, computeMove, collectDescendants, entryPath,
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
