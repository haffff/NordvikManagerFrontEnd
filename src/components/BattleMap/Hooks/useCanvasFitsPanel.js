import * as React from "react";

/**
 * Keeps a Fabric canvas the size of its dock panel. Runs when the panel's width or
 * height changes (or once the canvas exists and the map is loaded), not on every
 * render — the battlemap used to do this during render, which tied resizing to being
 * re-rendered on every dock commit.
 */
export function useCanvasFitsPanel(canvas, width, height, ready) {
  React.useEffect(() => {
    if (!ready || !canvas || !width || !height) return;
    canvas.setDimensions({ width, height });
  }, [canvas, width, height, ready]);
}

export default useCanvasFitsPanel;
