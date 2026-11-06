import * as React from "react";

/**
 * The dock library measures its box only when it mounts and on a window resize. When the
 * box changes size otherwise (the toolbar or the status bar changes height; the status
 * bar is taller while connecting), the dock kept its old size: a dark strip above the
 * status bar, or panels under it. A window resize event makes it measure again.
 */
export function useDockFollowsItsBox(el) {
  React.useEffect(() => {
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    let last = null;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[entries.length - 1].contentRect;
      const changed = !last || last.width !== width || last.height !== height;
      last = { width, height };
      if (changed) window.dispatchEvent(new Event("resize"));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
}

export default useDockFollowsItsBox;
