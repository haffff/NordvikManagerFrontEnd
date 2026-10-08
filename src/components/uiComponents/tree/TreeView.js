import * as React from "react";
import { Box, Flex } from "@chakra-ui/react";
import { FaChevronDown, FaChevronRight, FaGripVertical } from "react-icons/fa";
import themeColors from "../../../helpers/themeColors";
import UtilityHelper from "../../../helpers/UtilityHelper";
import { flattenVisible } from "./treeModel";

// Generic folder tree: virtualized rows (heights measured, so rows may differ), native
// drag & drop (so rows can also be dropped onto the battle map), keyboard navigation.
//
// It never changes the data it's given: a drop only calls onMove(dragId, targetId, position)
// and the owner decides what happens (usually: ask the server, re-render from its answer).

const OVERSCAN_PX = 300;
const FALLBACK_VIEWPORT = 600;     // used until the container has been measured (and in tests)
const INDENT_PX = 14;
const AUTO_OPEN_MS = 600;
const EDGE_SCROLL_PX = 36;
const DRAG_TYPE = "application/x-nordvik-tree";
const GUARDED_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "Enter", " ", "Delete", "Backspace"]);

const selectedBg = "rgba(66,153,225,0.18)";
const MIN_ROW_HEIGHT = 24;

// A positioned row that registers with the shared size observer while it's mounted
// (rows scrolled out of view unmount, and must stop being observed).
const MeasuredRow = React.forwardRef(function MeasuredRow({ observer, ...props }, _ref) {
  const elRef = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = elRef.current;
    if (!el || !observer) return undefined;
    observer.observe(el);
    return () => observer.unobserve(el);
  }, [observer]);
  return <Box ref={elRef} {...props} />;
});
const focusRing = `inset 0 0 0 1px ${themeColors.accentText}`;

// Where in a row the pointer is → drop position. Folders take "inside" in the middle half.
export function dropPositionFor(offsetY, height, isFolder) {
  const ratio = height > 0 && Number.isFinite(offsetY) ? offsetY / height : 0.5;
  if (isFolder) {
    if (ratio < 0.25) return "before";
    if (ratio > 0.75) return "after";
    return "inside";
  }
  return ratio < 0.5 ? "before" : "after";
}

const dropStyle = (position) => {
  const line = themeColors.accent;
  if (position === "before") return { boxShadow: `inset 0 2px 0 ${line}` };
  if (position === "after") return { boxShadow: `inset 0 -2px 0 ${line}` };
  if (position === "inside") return { boxShadow: `inset 0 0 0 1px ${line}`, background: selectedBg };
  return {};
};

// Index of the last row whose top is <= y (rows sorted by offset).
const rowAt = (offsets, y) => {
  let lo = 0, hi = offsets.length - 1, ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid] <= y) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
};

export const TreeView = ({
  nodes,
  openIds,
  onToggle,               // (id, open) => void
  query = "",
  selectedId,
  onSelect,               // (node) => void
  renderLabel,            // (node, { query }) => ReactNode
  draggable = false,
  onMove,                 // (dragId, targetId, position) => void
  onRowDragStart,         // (node, event) => void — e.g. payload for dropping on the battle map
  estimatedRowHeight = 28,
  emptyState = null,
  ariaLabel = "Tree",
}) => {
  const treeKey = React.useRef(UtilityHelper.GenerateUUID()).current;
  const containerRef = React.useRef(null);
  const heightsRef = React.useRef(new Map());
  const [measureVersion, setMeasureVersion] = React.useState(0);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewport, setViewport] = React.useState(0);
  const [focusedId, setFocusedId] = React.useState(null);
  const [keyboardNav, setKeyboardNav] = React.useState(false); // focus ring only while using keys
  const [drop, setDrop] = React.useState(null); // { id, position } | { end: true }
  const dragIdRef = React.useRef(null);
  const autoOpenRef = React.useRef({ id: null, timer: null });

  const rows = React.useMemo(() => flattenVisible(nodes ?? [], openIds ?? new Set(), query), [nodes, openIds, query]);
  const indexById = React.useMemo(() => new Map(rows.map((r, i) => [r.node.id, i])), [rows]);

  // Row tops from measured (or estimated) heights.
  const { offsets, total } = React.useMemo(() => {
    const heights = heightsRef.current;
    const offs = new Array(rows.length);
    let y = 0;
    for (let i = 0; i < rows.length; i++) {
      offs[i] = y;
      y += heights.get(rows[i].node.id) ?? estimatedRowHeight;
    }
    return { offsets: offs, total: y };
  }, [rows, measureVersion, estimatedRowHeight]); // eslint-disable-line react-hooks/exhaustive-deps

  // Container size.
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    setViewport(el.clientHeight);
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => setViewport(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Row size measurement: one observer for all rendered rows.
  const pendingRef = React.useRef(false);
  const rowObserver = React.useMemo(() => {
    if (typeof ResizeObserver === "undefined") return null;
    return new ResizeObserver((entries) => {
      const el = containerRef.current;
      let changed = false;
      let scrollFix = 0;
      for (const entry of entries) {
        const id = entry.target.getAttribute("data-row-id");
        const h = entry.target.offsetHeight;
        if (!id || !h) continue;
        const old = heightsRef.current.get(id) ?? estimatedRowHeight;
        if (old === h) continue;
        heightsRef.current.set(id, h);
        changed = true;
        // A row above the viewport changed height: keep what the user is looking at in place.
        const top = Number(entry.target.getAttribute("data-row-top"));
        if (el && top + old <= el.scrollTop) scrollFix += h - old;
      }
      if (!changed) return;
      if (el && scrollFix) el.scrollTop += scrollFix;
      if (!pendingRef.current) {
        pendingRef.current = true;
        requestAnimationFrame(() => { pendingRef.current = false; setMeasureVersion((v) => v + 1); });
      }
    });
  }, [estimatedRowHeight]);
  React.useEffect(() => () => rowObserver?.disconnect(), [rowObserver]);


  // Visible window.
  const height = viewport || FALLBACK_VIEWPORT;
  const start = rows.length ? rowAt(offsets, Math.max(0, scrollTop - OVERSCAN_PX)) : 0;
  let end = start;
  while (end < rows.length && offsets[end] < scrollTop + height + OVERSCAN_PX) end++;

  const onScroll = (e) => setScrollTop(e.currentTarget.scrollTop);

  // When the content shrinks (search, folders closing) the browser clamps scrollTop,
  // sometimes without a scroll event; re-read it so the visible window stays right.
  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (el && el.scrollTop !== scrollTop) setScrollTop(el.scrollTop);
  }, [total]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── keyboard ────────────────────────────────────────────────────────────
  const activeId = focusedId && indexById.has(focusedId) ? focusedId : selectedId;

  const scrollIntoView = (index) => {
    const el = containerRef.current;
    if (!el || index < 0) return;
    const top = offsets[index];
    const bottom = top + (heightsRef.current.get(rows[index].node.id) ?? estimatedRowHeight);
    if (top < el.scrollTop) el.scrollTop = top;
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
  };

  const focusIndex = (i) => {
    if (!rows.length) return;
    const idx = Math.max(0, Math.min(rows.length - 1, i));
    setFocusedId(rows[idx].node.id);
    scrollIntoView(idx);
  };

  const onKeyDown = (e) => {
    if (!rows.length) return;
    const i = activeId != null && indexById.has(activeId) ? indexById.get(activeId) : -1;
    const row = i >= 0 ? rows[i] : null;
    switch (e.key) {
      case "ArrowDown": focusIndex(i + 1); break;
      case "ArrowUp": focusIndex(i < 0 ? 0 : i - 1); break;
      case "Home": focusIndex(0); break;
      case "End": focusIndex(rows.length - 1); break;
      case "ArrowRight":
        if (row?.node.isFolder && !row.isOpen) onToggle?.(row.node.id, true);
        else if (row?.isOpen && row.hasChildren) focusIndex(i + 1);
        break;
      case "ArrowLeft":
        if (row?.node.isFolder && row.isOpen && !query) onToggle?.(row.node.id, false);
        else if (row?.node.parentId && indexById.has(row.node.parentId)) focusIndex(indexById.get(row.node.parentId));
        break;
      case "Enter":
      case " ":
        if (row) onSelect?.(row.node);
        break;
      default:
        return;
    }
    setKeyboardNav(true);
    e.preventDefault();
    e.stopPropagation();
  };

  // ── drag & drop ─────────────────────────────────────────────────────────
  const clearAutoOpen = () => {
    clearTimeout(autoOpenRef.current.timer);
    autoOpenRef.current = { id: null, timer: null };
  };

  // Stable identity so the window listeners added at drag start can be removed again.
  const endDragRef = React.useRef(null);
  endDragRef.current = () => { dragIdRef.current = null; setDrop(null); clearAutoOpen(); };
  const endDrag = React.useCallback(() => {
    window.removeEventListener("dragend", endDrag);
    window.removeEventListener("drop", endDrag);
    endDragRef.current();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRowDragStart = (e, node) => {
    dragIdRef.current = node.id;
    // The dragged row may scroll out of view (and unmount) mid-drag, so its own dragend
    // can't be relied on; catch the end of the drag on the window too.
    window.addEventListener("dragend", endDrag, { once: true });
    window.addEventListener("drop", endDrag, { once: true });
    try {
      e.dataTransfer.setData(DRAG_TYPE, `${treeKey}:${node.id}`);
      e.dataTransfer.effectAllowed = "copyMove";
    } catch { /* some test environments have no dataTransfer */ }
    onRowDragStart?.(node, e);
  };

  // Started in this tree: we remember the dragged id AND the drag carries our data type
  // (guards against a stale id if a cancelled drag never reported its end).
  const ownDrag = (e) => {
    if (dragIdRef.current == null) return false;
    const types = e?.dataTransfer?.types;
    return !types || Array.from(types).includes(DRAG_TYPE);
  };

  const onRowDragOver = (e, row) => {
    if (!ownDrag(e)) return; // e.g. files or another tree: let the panel handle it
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const position = dropPositionFor(e.clientY - rect.top, rect.height, row.node.isFolder);
    if (drop?.id !== row.node.id || drop?.position !== position) setDrop({ id: row.node.id, position });

    // Hovering the middle of a closed folder opens it after a moment.
    if (position === "inside" && row.node.isFolder && !row.isOpen) {
      if (autoOpenRef.current.id !== row.node.id) {
        clearAutoOpen();
        autoOpenRef.current = {
          id: row.node.id,
          timer: setTimeout(() => onToggle?.(row.node.id, true), AUTO_OPEN_MS),
        };
      }
    } else if (autoOpenRef.current.id) clearAutoOpen();
  };

  const onRowDrop = (e, row) => {
    if (!ownDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const position = dropPositionFor(e.clientY - rect.top, rect.height, row.node.isFolder);
    const dragId = dragIdRef.current;
    endDrag();
    if (dragId !== row.node.id) onMove?.(dragId, row.node.id, position);
  };

  // Empty space below the rows, and edge auto-scroll.
  const onContainerDragOver = (e) => {
    if (!ownDrag(e)) return;
    const el = containerRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      if (e.clientY - rect.top < EDGE_SCROLL_PX) el.scrollTop -= 12;
      else if (rect.bottom - e.clientY < EDGE_SCROLL_PX) el.scrollTop += 12;
    }
    e.preventDefault();
    if (!drop?.end) setDrop({ end: true });
  };

  const onContainerDrop = (e) => {
    if (!ownDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const dragId = dragIdRef.current;
    endDrag();
    onMove?.(dragId, null, "end");
  };

  React.useEffect(() => () => clearTimeout(autoOpenRef.current.timer), []);

  // ── render ──────────────────────────────────────────────────────────────
  const rowDomId = (id) => `${treeKey}-row-${id}`;

  return (
    <Box
      ref={containerRef}
      role="tree"
      aria-label={ariaLabel}
      aria-activedescendant={activeId != null && indexById.has(activeId) ? rowDomId(activeId) : undefined}
      tabIndex={0}
      flex={1}
      h="100%"
      overflowY="auto"
      position="relative"
      outline="none"
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      onKeyUp={(e) => {
        // Game shortcuts fire on keyup (Delete = remove selected map elements, Ctrl+C/V…).
        if (GUARDED_KEYS.has(e.key) || e.ctrlKey || e.metaKey) e.stopPropagation();
      }}
      onDragOver={onContainerDragOver}
      onDrop={onContainerDrop}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDrop(null); }}
    >
      {!rows.length && emptyState}
      <div style={{ position: "relative", height: total, boxShadow: drop?.end ? `inset 0 -2px 0 ${themeColors.accent}` : undefined }}>
        {rows.slice(start, end).map((row, k) => {
          const i = start + k;
          const { node } = row;
          const isSelected = node.id === selectedId;
          const isFocused = keyboardNav && node.id === activeId && focusedId != null;
          return (
            <MeasuredRow
              key={node.id}
              observer={rowObserver}
              id={rowDomId(node.id)}
              data-row-id={node.id}
              data-row-top={offsets[i]}
              role="treeitem"
              aria-level={row.depth + 1}
              aria-expanded={node.isFolder ? row.isOpen : undefined}
              aria-selected={isSelected}
              onDragEnd={endDrag}
              onDragOver={(e) => onRowDragOver(e, row)}
              onDrop={(e) => onRowDrop(e, row)}
              onClick={() => { setKeyboardNav(false); setFocusedId(node.id); onSelect?.(node); }}
              onDoubleClick={() => node.isFolder && !query && onToggle?.(node.id, !row.isOpen)}
              cursor="pointer"
              bg={isSelected ? selectedBg : undefined}
              _hover={{ bg: isSelected ? selectedBg : themeColors.surfaceHover }}
              style={{
                position: "absolute", left: 0, right: 0, top: offsets[i],
                ...(isFocused ? { boxShadow: focusRing } : null),
                ...(drop?.id === node.id ? dropStyle(drop.position) : null),
              }}
            >
              <Flex align="center" pr="2px" style={{ minHeight: MIN_ROW_HEIGHT, paddingLeft: row.depth * INDENT_PX + 2 }}>
                {/* Rows are dragged by this grip only: a row can hold controls (a volume
                    slider, buttons) that a whole-row drag would take over. */}
                {draggable && (
                  <Box
                    data-drag-handle
                    draggable
                    aria-label={`Drag ${node.name ?? ""}`.trim()}
                    title="Drag to move"
                    onDragStart={(e) => {
                      const rowEl = e.currentTarget.closest('[role="treeitem"]');
                      try { if (rowEl) e.dataTransfer.setDragImage?.(rowEl, 12, 12); } catch { /* jsdom */ }
                      handleRowDragStart(e, node);
                    }}
                    w="14px" flexShrink={0} color={themeColors.textSubtle} cursor="grab"
                    display="flex" justifyContent="center"
                  >
                    <FaGripVertical size={10} />
                  </Box>
                )}
                <Box
                  w="16px" flexShrink={0} color={themeColors.textMuted} display="flex" justifyContent="center"
                  onClick={(e) => {
                    if (!node.isFolder || query) return;
                    e.stopPropagation();
                    onToggle?.(node.id, !row.isOpen);
                  }}
                  aria-hidden
                >
                  {node.isFolder && (row.hasChildren || !query)
                    ? (row.isOpen ? <FaChevronDown size={9} /> : <FaChevronRight size={9} />)
                    : null}
                </Box>
                <Box flex={1} minW={0}>{renderLabel ? renderLabel(node, { query }) : node.name}</Box>
              </Flex>
            </MeasuredRow>
          );
        })}
      </div>
    </Box>
  );
};

export default TreeView;
