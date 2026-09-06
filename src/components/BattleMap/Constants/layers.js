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
