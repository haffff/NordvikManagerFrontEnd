import { describe, it, expect } from 'vitest';
import { compareLayers, RESERVED_LAYERS } from './layers';

// Regression coverage for the sortLayers comparator fix. The old comparator —
// `a.layer > b.layer || a.insideLayerIndex > b.insideLayerIndex ? 1 : -1` — was
// not a valid ordering: for two same-layer objects (both insideLayerIndex
// undefined) it returned -1 for BOTH (a,b) and (b,a), so sort order shuffled
// unpredictably; and the `||` let a lower-layer object with a nonzero
// insideLayerIndex sort above a higher-layer object, inverting the reserved-layer
// hierarchy.
describe('compareLayers', () => {
  it('is consistent for two same-layer objects: it never claims a<b AND b<a at once', () => {
    const a = { layer: RESERVED_LAYERS.TOKEN, insideLayerIndex: undefined };
    const b = { layer: RESERVED_LAYERS.TOKEN, insideLayerIndex: undefined };
    // The old comparator returned -1 for BOTH (a,b) and (b,a) here — each object
    // claimed to sort before the other, which is not a valid comparator and made
    // Array.prototype.sort's behavior on same-layer objects unpredictable.
    expect(compareLayers(a, b)).toBe(0);
    expect(compareLayers(b, a)).toBe(0);
  });

  it('preserves the original relative order of same-layer objects (stable sort over a valid "equal" comparator)', () => {
    const objects = [
      { id: 1, layer: 100 },
      { id: 2, layer: 100 },
      { id: 3, layer: 100 },
    ];
    // Array.sort is stable in modern engines given a comparator that consistently
    // returns 0 for equal elements — unlike the old comparator (which returned -1
    // both ways), this must not reorder them at all.
    expect([...objects].sort(compareLayers).map((o) => o.id)).toEqual([1, 2, 3]);
    expect([...objects].reverse().sort(compareLayers).map((o) => o.id)).toEqual([3, 2, 1]);
  });

  it('never lets a lower-layer object with a nonzero insideLayerIndex outrank a strictly higher layer', () => {
    const mapObject = { layer: RESERVED_LAYERS.MAP, insideLayerIndex: 900 }; // e.g. a background sent way back
    const tokenObject = { layer: RESERVED_LAYERS.TOKEN, insideLayerIndex: 0 };
    const sorted = [mapObject, tokenObject].sort(compareLayers);
    expect(sorted[0]).toBe(mapObject);
    expect(sorted[1]).toBe(tokenObject);
  });

  it('uses insideLayerIndex only as a tie-break within the same layer', () => {
    const back = { id: 'back', layer: 200, insideLayerIndex: 10 };
    const front = { id: 'front', layer: 200, insideLayerIndex: 20 };
    expect([front, back].sort(compareLayers).map((o) => o.id)).toEqual(['back', 'front']);
  });

  it('treats a missing insideLayerIndex as 0 for the tie-break', () => {
    const noIndex = { id: 'no-index', layer: 200 };
    const positive = { id: 'positive', layer: 200, insideLayerIndex: 5 };
    expect([positive, noIndex].sort(compareLayers).map((o) => o.id)).toEqual(['no-index', 'positive']);
  });

  it('sorts the reserved layers into the documented Map < Grid < Token order', () => {
    const objects = [
      { id: 'token', layer: RESERVED_LAYERS.TOKEN },
      { id: 'map', layer: RESERVED_LAYERS.MAP },
      { id: 'grid', layer: RESERVED_LAYERS.GRID },
    ];
    expect(objects.sort(compareLayers).map((o) => o.id)).toEqual(['map', 'grid', 'token']);
  });
});
