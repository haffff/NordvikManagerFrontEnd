import { describe, it, expect, vi } from 'vitest';
import { installLayerTargeting, setLayerView } from './LayerTargeting';

// Fabric gives a click to the topmost element under the pointer that has `evented`
// set — including elements on another layer, which aren't selectable there. An
// element on a layer above the token layer then swallowed clicks meant for a token
// under it, and the token could only be picked with a selection rectangle.

const canvas = () => ({
  selectedLayer: 1,
  _activeObject: null,
  // Fabric's own check: visible, evented and under the pointer (always, here).
  _checkTarget: (pointer, obj) => !!obj?.visible,
  _renderObjects(ctx, objects) { objects.forEach((o) => o.render(ctx)); },
  _collectObjects() { return this.collected; },
  discardActiveObject() { this._activeObject = null; },
  getActiveObjects() { return this._activeObject ? [this._activeObject] : []; },
  requestRenderAll() {},
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

  // Picking for an action (RequestTargets) makes everything unselectable, and the element
  // to pick may sit on any layer (a wall on the map layer): clicks reach it, unless its
  // layer is hidden.
  it('lets a click reach an element on any layer while picking for an action', () => {
    const c = canvas();
    installLayerTargeting(c);
    c.pickTargets = {};
    const wall = { layer: 5, visible: true, selectable: false };

    expect(c._checkTarget({}, wall, {})).toBe(true);

    setLayerView(c, { hidden: new Set([5]), dimmed: new Set() });
    expect(c._checkTarget({}, wall, {})).toBeFalsy();
  });

  it('installs once, even when the map is reloaded on the same canvas', () => {
    const c = canvas();
    installLayerTargeting(c);
    const patched = c._checkTarget;
    installLayerTargeting(c);

    expect(c._checkTarget).toBe(patched);
  });

  // Token UI (bars, the "open card" button) sits on its own TOKEN_UI layer (110)
  // so it draws above every token, but it belongs to the token layer.
  it('counts token UI as part of the token layer', () => {
    const c = { ...canvas(), selectedLayer: 100 };
    installLayerTargeting(c);
    const openCard = { isTokenUI: true, layer: 110, visible: true, selectable: false };

    expect(c._checkTarget({}, openCard, {})).toBe(true);

    c.selectedLayer = -100; // working on the map layer
    expect(c._checkTarget({}, openCard, {})).toBeFalsy();
  });
});

// GM-only and hidden custom layers (see layerVisibility.js): not drawn / drawn faded,
// and not clickable or rectangle-selectable when not drawn.
describe('layer view on the canvas', () => {
  const view = { hidden: new Set([150]), dimmed: new Set([140]) };

  // A fake 2D context that records the alpha each element is drawn with.
  const recordingCtx = () => {
    const drawn = [];
    const stack = [];
    const ctx = {
      globalAlpha: 1,
      save() { stack.push(this.globalAlpha); },
      restore() { this.globalAlpha = stack.pop(); },
    };
    const element = (name, layer, extra = {}) => ({ name, layer, visible: true, selectable: true, ...extra, render: (c) => drawn.push([name, c.globalAlpha]) });
    return { ctx, drawn, element };
  };

  it('leaves out hidden layers and draws GM-only ones faded', () => {
    const c = canvas();
    installLayerTargeting(c);
    setLayerView(c, view);
    const { ctx, drawn, element } = recordingCtx();

    c._renderObjects(ctx, [element('secret', 150), element('gm', 140), element('token', 100), element('bar', 110, { isTokenUI: true })]);

    expect(drawn.map(([n]) => n)).toEqual(['gm', 'token', 'bar']);
    expect(drawn[0][1]).toBeLessThan(1);
    expect(drawn[1][1]).toBe(1);
    expect(ctx.globalAlpha).toBe(1);
  });

  it('draws everything as before without a view', () => {
    const c = canvas();
    installLayerTargeting(c);
    const { ctx, drawn, element } = recordingCtx();

    c._renderObjects(ctx, [element('a', 150), element('b', 140)]);

    expect(drawn).toEqual([['a', 1], ['b', 1]]);
  });

  it("doesn't let hidden elements be clicked, even the selected one", () => {
    const c = { ...canvas(), selectedLayer: 150 };
    installLayerTargeting(c);
    const secret = { layer: 150, visible: true, selectable: true };
    c._activeObject = secret;
    setLayerView(c, view);

    expect(c._checkTarget({}, secret, {})).toBeFalsy();
    expect(c._activeObject).toBeNull(); // the selection is dropped when its layer is hidden
  });

  it('leaves hidden elements out of a rectangle selection', () => {
    const c = canvas();
    installLayerTargeting(c);
    setLayerView(c, view);
    const secret = { layer: 150 };
    const token = { layer: 100 };
    c.collected = [secret, token];

    expect(c._collectObjects({})).toEqual([token]);
  });
});

// One element with a size or place that isn't a number (NaN, Infinity) made Fabric's
// drawImage throw in the middle of drawing the map, which then left trails of
// everything moved. It's left out (and named in the console) instead.
describe('elements that cannot be drawn', () => {
  const ctx = { save() {}, restore() {}, globalAlpha: 1 };
  const element = (name, extra = {}) => ({ name, layer: 100, width: 10, height: 10, scaleX: 1, scaleY: 1, left: 0, top: 0, ...extra });

  it.each([
    ['without a layer view', undefined],
    ['with a layer view', { hidden: new Set([150]), dimmed: new Set() }],
  ])('skips them, %s', (_, view) => {
    const drawn = [];
    const c = canvas();
    installLayerTargeting(c);
    if (view) setLayerView(c, view);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const of = (o) => ({ ...o, render: () => drawn.push(o.name) });

    c._renderObjects(ctx, [of(element('ok')), of(element('nan', { width: NaN })), of(element('inf', { scaleX: Infinity })), of(element('ok2'))]);

    expect(drawn).toEqual(['ok', 'ok2']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
