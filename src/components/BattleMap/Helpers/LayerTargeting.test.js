import { describe, it, expect } from 'vitest';
import { installLayerTargeting } from './LayerTargeting';

// Fabric gives a click to the topmost element under the pointer that has `evented`
// set — including elements on another layer, which aren't selectable there. An
// element on a layer above the token layer then swallowed clicks meant for a token
// under it, and the token could only be picked with a selection rectangle.

const canvas = () => ({
  selectedLayer: 1,
  _activeObject: null,
  // Fabric's own check: visible, evented and under the pointer (always, here).
  _checkTarget: (pointer, obj) => !!obj?.visible,
});

describe('installLayerTargeting', () => {
  it('lets clicks pass through elements on another layer', () => {
    const c = canvas();
    installLayerTargeting(c);

    const overlay = { layer: 5, visible: true, selectable: false };
    expect(c._checkTarget({}, overlay, {})).toBeFalsy();
  });

  it('still targets elements on the layer being worked on', () => {
    const c = canvas();
    installLayerTargeting(c);

    expect(c._checkTarget({}, { layer: 1, visible: true, selectable: true }, {})).toBe(true);
    // Not selectable for this player, but on this layer: keeps blocking as before.
    expect(c._checkTarget({}, { layer: 1, visible: true, selectable: false }, {})).toBe(true);
  });

  it('keeps elements without a layer, and the active object (e.g. the grid being edited)', () => {
    const c = canvas();
    installLayerTargeting(c);
    const grid = { name: '.grid', layer: -1, visible: true, selectable: false };
    c._activeObject = grid;

    expect(c._checkTarget({}, { visible: true }, {})).toBe(true);
    expect(c._checkTarget({}, grid, {})).toBe(true);
  });

  it('keeps an element of another layer that was made selectable (edit mode)', () => {
    const c = canvas();
    installLayerTargeting(c);

    expect(c._checkTarget({}, { layer: 5, visible: true, selectable: true }, {})).toBe(true);
  });

  it('installs once, even when the map is reloaded on the same canvas', () => {
    const c = canvas();
    installLayerTargeting(c);
    const patched = c._checkTarget;
    installLayerTargeting(c);

    expect(c._checkTarget).toBe(patched);
  });
});
