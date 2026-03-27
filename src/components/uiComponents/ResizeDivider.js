import * as React from "react";
import { Box } from "@chakra-ui/react";

// ── Design tokens (kept local so the component is self-contained) ─────────────
const BORDER_CLR = "rgb(65,65,65)";
const CLR_BLUE   = "rgb(100,150,230)";
const MIN_COL    = 80; // px — minimum width any column may shrink to

// ── useDragResize ─────────────────────────────────────────────────────────────
// Manages N-1 draggable dividers for N columns.
//
// Usage:
//   const { fracs, onDividerMouseDown } = useDragResize(containerRef, [1/3, 1/3]);
//   // fracs[0] and fracs[1] are percentages for the first two columns;
//   // the last column should use flex={1} to fill remaining space.
//
// containerRef — ref attached to the flex row that holds all columns + dividers.
// initialFractions — starting fractional widths for the first N-1 columns.
export function useDragResize(containerRef, initialFractions = [0.33, 0.33]) {
  const [fracs, setFracs] = React.useState(initialFractions);
  const dragging = React.useRef(null); // { colIndex, startX, startFrac }

  const onDividerMouseDown = React.useCallback((colIndex, e) => {
    e.preventDefault();
    dragging.current = { colIndex, startX: e.clientX, startFrac: fracs[colIndex] };

    const onMove = (me) => {
      if (!dragging.current || !containerRef.current) return;
      const { colIndex, startX, startFrac } = dragging.current;
      const totalW = containerRef.current.getBoundingClientRect().width;
      const delta  = (me.clientX - startX) / totalW;
      const minFrac = MIN_COL / totalW;
      const maxFrac = 1 - minFrac * (initialFractions.length + 1);
      setFracs((prev) => {
        const next = [...prev];
        next[colIndex] = Math.min(maxFrac, Math.max(minFrac, startFrac + delta));
        return next;
      });
    };

    const onUp = () => {
      dragging.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [fracs, containerRef, initialFractions.length]);

  return { fracs, onDividerMouseDown };
}

// ── ResizeDivider ─────────────────────────────────────────────────────────────
// A thin vertical bar that the user can drag left/right to resize adjacent columns.
//
// Props:
//   onMouseDown — (e) => void   pass the handler from useDragResize
//   color       — optional override for the idle border colour
//   hoverColor  — optional override for the hover/active colour
export const ResizeDivider = React.memo(({
  onMouseDown,
  color     = BORDER_CLR,
  hoverColor = CLR_BLUE,
}) => (
  <Box
    width="4px"
    flexShrink={0}
    cursor="col-resize"
    bg={color}
    _hover={{ bg: hoverColor }}
    _active={{ bg: hoverColor }}
    transition="background 0.15s"
    onMouseDown={onMouseDown}
    userSelect="none"
  />
));

export default ResizeDivider;
