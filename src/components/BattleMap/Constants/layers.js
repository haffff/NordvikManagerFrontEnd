// Reserved battle-map layer ids — do not renumber, real per-game data already
// persists at these exact literal values. Custom (GM-defined) layers are
// allocated ids that fit BETWEEN these anchors (see CustomLayerLayout.cs on the
// backend, which mirrors this file) rather than always above everything.
export const RESERVED_LAYERS = {
  GRID: 0,
  MAP: -100,
  TOKEN: 100,
  TOKEN_UI: 110,
};

// Purely an internal allocation bound for the "above everything" band — not a
// real layer, never rendered, never shown to the user. Must stay above
// TOKEN_UI so a custom layer inserted "at the top" never ends up rendering
// underneath the token health-bar/name-label overlay. Keep in sync with the
// backend's CustomLayerLayout.TopBandCeiling.
export const TOP_BAND_CEILING = 1000;

// Canvas stacking-order comparator, shared by LoadCanvas.js's sortLayers() and
// OnUpdateElementBehavior.js's "layer" case — must stay identical in both, so it
// lives here once instead of as two copies that can drift.
//
// A naive `a.layer > b.layer || a.insideLayerIndex > b.insideLayerIndex ? 1 : -1`
// is NOT a valid ordering: for two objects on the same layer (both
// insideLayerIndex undefined), it returns -1 for both (a,b) and (b,a), so sort
// order shuffles unpredictably; and the `||` short-circuits across layers too,
// letting a lower-layer object with a nonzero insideLayerIndex sort above a
// higher-layer object, inverting the reserved-layer hierarchy. A real numeric
// comparator with layer as the primary key and insideLayerIndex as the
// tie-break fixes both.
export function compareLayers(a, b) {
  return (a.layer - b.layer) || ((a.insideLayerIndex || 0) - (b.insideLayerIndex || 0));
}
