import { vi, describe, it, expect, afterEach } from "vitest";
import * as React from "react";
import { screen, fireEvent, act, createEvent } from "@testing-library/react";
import { renderWithProviders } from "../../../setupTests";
import { TreeView, dropPositionFor } from "./TreeView";
import { buildTree } from "./treeModel";

const entries = [
  { id: "maps", isFolder: true, name: "Maps", head: true, next: "e-goblin" },
  { id: "e-goblin", targetId: "goblin" },
  { id: "e-dungeon", targetId: "dungeon", head: true, next: "e-forest", parentId: "maps" },
  { id: "e-forest", targetId: "forest", parentId: "maps" },
];
const items = [{ id: "goblin", name: "Goblin" }, { id: "dungeon", name: "Dungeon" }, { id: "forest", name: "Forest" }];

// Small stateful host so toggling works like it does in the real panels.
const Host = ({ nodes, initialOpen = [], ...props }) => {
  const [open, setOpen] = React.useState(new Set(initialOpen));
  const [selected, setSelected] = React.useState(null);
  return (
    <div style={{ height: 600 }}>
      <TreeView
        nodes={nodes}
        openIds={open}
        onToggle={(id, isOpen) => setOpen((s) => { const n = new Set(s); isOpen ? n.add(id) : n.delete(id); return n; })}
        selectedId={selected}
        onSelect={(n) => { setSelected(n.id); props.onSelect?.(n); }}
        {...props}
      />
    </div>
  );
};

const rowNames = () => screen.getAllByRole("treeitem").map((r) => r.textContent);

// A dataTransfer good enough for jsdom drag events.
const makeDataTransfer = () => {
  const data = {};
  return {
    setData: (t, v) => { data[t] = v; },
    getData: (t) => data[t] ?? "",
    get types() { return Object.keys(data); },
    effectAllowed: "all",
    dropEffect: "move",
  };
};

// jsdom has no DragEvent, so clientY must be put on the event by hand.
const drag = (type, el, dataTransfer, clientY) => {
  const evt = createEvent[type](el, { dataTransfer });
  if (clientY !== undefined) Object.defineProperty(evt, "clientY", { value: clientY });
  fireEvent(el, evt);
};

const rect = (top, height) => ({ top, height, bottom: top + height, left: 0, right: 200, width: 200, x: 0, y: top, toJSON() {} });

afterEach(() => { vi.restoreAllMocks(); });

describe("dropPositionFor", () => {
  it("splits folders in before/inside/after and leaves in before/after", () => {
    expect(dropPositionFor(2, 28, true)).toBe("before");
    expect(dropPositionFor(14, 28, true)).toBe("inside");
    expect(dropPositionFor(26, 28, true)).toBe("after");
    expect(dropPositionFor(5, 28, false)).toBe("before");
    expect(dropPositionFor(20, 28, false)).toBe("after");
  });
});

describe("TreeView", () => {
  const nodes = buildTree(entries, items);

  it("shows folder children only when opened, by click on the arrow", () => {
    renderWithProviders(<Host nodes={nodes} />);
    expect(rowNames()).toEqual(["Maps", "Goblin"]);
    fireEvent.doubleClick(screen.getByText("Maps"));
    expect(rowNames()).toEqual(["Maps", "Dungeon", "Forest", "Goblin"]);
  });

  it("search opens folders that contain matches", () => {
    renderWithProviders(<Host nodes={nodes} query="fore" />);
    expect(rowNames()).toEqual(["Maps", "Forest"]);
  });

  it("keyboard: arrows move, right opens, left goes to parent, Enter selects", () => {
    const onSelect = vi.fn();
    renderWithProviders(<Host nodes={nodes} onSelect={onSelect} />);
    const tree = screen.getByRole("tree");
    fireEvent.keyDown(tree, { key: "ArrowDown" });  // focus Maps
    fireEvent.keyDown(tree, { key: "ArrowRight" }); // open Maps
    expect(rowNames()).toEqual(["Maps", "Dungeon", "Forest", "Goblin"]);
    fireEvent.keyDown(tree, { key: "ArrowRight" }); // into first child
    fireEvent.keyDown(tree, { key: "ArrowDown" });  // Forest
    fireEvent.keyDown(tree, { key: "Enter" });
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ name: "Forest" }));
    fireEvent.keyDown(tree, { key: "ArrowLeft" });  // back to Maps
    fireEvent.keyDown(tree, { key: "Enter" });
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ name: "Maps" }));
    fireEvent.keyDown(tree, { key: "End" });
    fireEvent.keyDown(tree, { key: " " });
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ name: "Goblin" }));
  });

  it("renders only the rows in view (virtualization)", () => {
    const many = Array.from({ length: 1000 }, (_, i) => ({ id: `e${i}`, targetId: `t${i}`, next: i < 999 ? `e${i + 1}` : null, head: i === 0 }));
    const manyItems = many.map((_, i) => ({ id: `t${i}`, name: `Item ${i}` }));
    renderWithProviders(<Host nodes={buildTree(many, manyItems)} />);
    const rendered = screen.getAllByRole("treeitem").length;
    expect(rendered).toBeGreaterThan(10);
    expect(rendered).toBeLessThan(100);
  });

  it("positions rows by their measured heights", () => {
    let callback;
    const observed = [];
    vi.stubGlobal("ResizeObserver", class {
      constructor(cb) { callback ??= null; this.cb = cb; }
      observe(el) { observed.push({ el, ro: this }); }
      unobserve() {}
      disconnect() {}
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((fn) => { fn(); return 0; });
    renderWithProviders(<Host nodes={nodes} initialOpen={["maps"]} />);

    // "Maps" turns out 60px tall; rows below it must move down.
    const mapsRow = observed.find((o) => o.el.getAttribute?.("data-row-id") === "maps");
    Object.defineProperty(mapsRow.el, "offsetHeight", { configurable: true, value: 60 });
    act(() => mapsRow.ro.cb([{ target: mapsRow.el }]));

    const top = (id) => screen.getAllByRole("treeitem").find((r) => r.getAttribute("data-row-id") === id).style.top;
    expect(top("e-dungeon")).toBe("60px");
    expect(top("e-forest")).toBe("88px");
    vi.unstubAllGlobals();
  });

  it("keeps one scroll container when going empty and back (rows render from the top)", () => {
    const empty = <Host nodes={[]} emptyState={<p>No items</p>} />;
    const { rerender } = renderWithProviders(empty);
    const tree = screen.getByRole("tree");
    expect(screen.getByText("No items")).toBeInTheDocument();
    rerender(<Host nodes={nodes} />);
    expect(screen.getByRole("tree")).toBe(tree);
    expect(rowNames()).toEqual(["Maps", "Goblin"]);
    rerender(<Host nodes={nodes} query="zzz" emptyState={<p>No match</p>} />);
    expect(screen.getByText("No match")).toBeInTheDocument();
    rerender(<Host nodes={nodes} />);
    expect(screen.getByRole("tree")).toBe(tree);
    expect(rowNames()).toEqual(["Maps", "Goblin"]);
  });

  it("keeps Delete / Ctrl+C away from game shortcuts", () => {
    const onKeyUp = vi.fn();
    renderWithProviders(<div onKeyUp={onKeyUp}><Host nodes={nodes} /></div>);
    const tree = screen.getByRole("tree");
    fireEvent.keyUp(tree, { key: "Delete" });
    fireEvent.keyUp(tree, { key: "c", ctrlKey: true });
    expect(onKeyUp).not.toHaveBeenCalled();
    fireEvent.keyUp(tree, { key: "p", shiftKey: true }); // other shortcuts still work
    expect(onKeyUp).toHaveBeenCalledTimes(1);
  });

  it("stops observing rows that are no longer rendered", () => {
    const observed = new Set();
    vi.stubGlobal("ResizeObserver", class {
      observe(el) { observed.add(el); }
      unobserve(el) { observed.delete(el); }
      disconnect() {}
    });
    const { rerender } = renderWithProviders(<Host nodes={nodes} initialOpen={["maps"]} />);
    const rows = () => [...observed].filter((el) => el.getAttribute?.("data-row-id")).length;
    expect(rows()).toBe(4);
    rerender(<Host nodes={nodes} query="goblin" />);
    expect(rows()).toBe(1);
    vi.unstubAllGlobals();
  });

  describe("drag & drop", () => {
    const setup = (extra = {}) => {
      const onMove = vi.fn();
      const onRowDragStart = vi.fn();
      renderWithProviders(<Host nodes={nodes} initialOpen={["maps"]} draggable onMove={onMove} onRowDragStart={onRowDragStart} {...extra} />);
      const row = (id) => screen.getAllByRole("treeitem").find((r) => r.getAttribute("data-row-id") === id);
      // Drags start from a row's grip, not the row: a row can hold controls (a volume
      // slider) that a whole-row drag would take over.
      const handle = (id) => row(id).querySelector("[data-drag-handle]");
      return { onMove, onRowDragStart, row, handle };
    };

    it("drags by the grip only; the row itself isn't draggable", () => {
      const { row, handle } = setup();
      expect(row("e-goblin")).not.toHaveAttribute("draggable", "true");
      expect(handle("e-goblin")).toHaveAttribute("draggable", "true");
      expect(handle("e-goblin")).toHaveAttribute("aria-label", "Drag Goblin");
    });

    it("has no grips when the tree isn't draggable", () => {
      renderWithProviders(<Host nodes={nodes} initialOpen={["maps"]} />);
      expect(document.querySelector("[data-drag-handle]")).toBeNull();
    });

    it("drops before/after/inside depending on pointer position", () => {
      const { onMove, onRowDragStart, row, handle } = setup();
      const dt = makeDataTransfer();
      fireEvent.dragStart(handle("e-goblin"), { dataTransfer: dt });
      expect(onRowDragStart).toHaveBeenCalledWith(expect.objectContaining({ id: "e-goblin" }), expect.anything());

      vi.spyOn(row("e-dungeon"), "getBoundingClientRect").mockReturnValue(rect(100, 28));
      drag("dragOver", row("e-dungeon"), dt, 103);
      drag("drop", row("e-dungeon"), dt, 103);
      expect(onMove).toHaveBeenLastCalledWith("e-goblin", "e-dungeon", "before");

      fireEvent.dragStart(handle("e-goblin"), { dataTransfer: dt });
      vi.spyOn(row("maps"), "getBoundingClientRect").mockReturnValue(rect(0, 28));
      drag("drop", row("maps"), dt, 14);
      expect(onMove).toHaveBeenLastCalledWith("e-goblin", "maps", "inside");
    });

    it("ignores drags that didn't start in this tree (e.g. files)", () => {
      const { onMove, row, handle } = setup();
      const files = makeDataTransfer();
      files.setData("Files", "x");
      vi.spyOn(row("maps"), "getBoundingClientRect").mockReturnValue(rect(0, 28));
      drag("drop", row("maps"), files, 14);
      expect(onMove).not.toHaveBeenCalled();
    });

    it("does nothing when a row is dropped on itself", () => {
      const { onMove, row, handle } = setup();
      const dt = makeDataTransfer();
      fireEvent.dragStart(handle("e-forest"), { dataTransfer: dt });
      vi.spyOn(row("e-forest"), "getBoundingClientRect").mockReturnValue(rect(50, 28));
      drag("drop", row("e-forest"), dt, 60);
      expect(onMove).not.toHaveBeenCalled();
    });

    it("dropping on empty space moves to the end of the top level", () => {
      const { onMove, row, handle } = setup();
      const dt = makeDataTransfer();
      fireEvent.dragStart(handle("e-dungeon"), { dataTransfer: dt });
      drag("drop", screen.getByRole("tree"), dt, 500);
      expect(onMove).toHaveBeenLastCalledWith("e-dungeon", null, "end");
    });
  });
});
