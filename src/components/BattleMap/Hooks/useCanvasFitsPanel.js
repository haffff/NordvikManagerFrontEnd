import * as React from "react";

/**
 * Keeps a Fabric canvas the size of its dock panel. Runs when the panel's width or
 * height changes (or once the canvas exists and the map is loaded), not on every
 * render — the battlemap used to do this during render, which tied resizing to being
 * re-rendered on every dock commit.
 *
 * `box` is the map's own element (or a ref to it): the panel's rect also counts the panel's padding and
 * margin, and a canvas that big made the panel scroll. The panel size is the fallback
 * until the box is laid out.
 */
export function useCanvasFitsPanel(canvas, width, height, ready, box) {
  React.useEffect(() => {
    if (!ready || !canvas || !width || !height) return;
    const el = box && "current" in box ? box.current : box;
    const inner = el?.clientWidth && el?.clientHeight
      ? { width: el.clientWidth, height: el.clientHeight }
      : { width, height };
    canvas.setDimensions(inner);
  }, [canvas, width, height, ready, box]);
}

export default useCanvasFitsPanel;
