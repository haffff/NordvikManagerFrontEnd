import GridFactoryInstance from "../Factories/GridFactory";

export default function drawGrid(canvas, map) {
  if (!canvas || !map) return null;

  try {
    // remove existing grid groups
    const existingGridObjects = (canvas.getObjects("group") || []).filter((x) => x.name === ".grid");
    if (existingGridObjects.length) {
      existingGridObjects.forEach((g) => {
        try { canvas.remove(g); } catch (e) { /* ignore */ }
      });
    }

    if (map.gridVisible) {
      const grid = GridFactoryInstance.DrawGrid(map.gridSize, [map.width, map.height], map.id);
      // find first indexed layer object (layer >= 0) and insert before it, otherwise push to end
      const found = (canvas._objects || []).findIndex((x) => x.layer >= 0);
      const insertIndex = found >= 0 ? found : (canvas._objects ? canvas._objects.length : 0);
      try {
        canvas.insertAt(grid, insertIndex);
      } catch (e) {
        // fallback to add
        try { canvas.add(grid); } catch (e2) { /* ignore */ }
      }
      return grid;
    }
  } catch (e) {
    // do not throw further
    // eslint-disable-next-line no-console
    console.warn('GridHelper.drawGrid failed', e);
  }

  return null;
}
