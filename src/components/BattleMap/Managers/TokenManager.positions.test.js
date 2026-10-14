import { vi, describe, it, expect } from 'vitest';
import { fabric } from 'fabric';

vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: { getMaterialAsync: vi.fn(), getResourceString: vi.fn() },
  ActiveTransportManager: { Send: vi.fn() },
}));
vi.mock('../../../ClientMediator', () => ({ default: { sendCommand: vi.fn(), sendCommandAsync: vi.fn() } }));

import TokenManager from './TokenManager';

// A token's bars, name tags etc. are placed in canvas coordinates. While tokens are in
// a multi-selection, Fabric measures their own left/top from the selection's centre,
// so the bars must still land next to the token, not near the canvas corner.

const GRID = 50;

const token = (left, top) => {
  const t = new fabric.Rect({ left, top, width: GRID, height: GRID, strokeWidth: 0, originX: 'left', originY: 'top' });
  t.id = `tok-${left}`;
  t.additionalObjects = [new fabric.Rect({ width: 40, height: 4 })];
  t.additionalObjects[0].tokenData = { anchor: 'left-top', offsetX: 0, offsetY: -6 };
  return t;
};

const manager = (canvas) => {
  const tm = new TokenManager();
  tm._getCanvas = () => canvas;
  tm._getSelectedMap = () => ({ id: 'map-1', gridSize: GRID });
  return tm;
};

describe('TokenManager.UpdateTokenUIPositions', () => {
  it('places a lone token\'s bar at the token', () => {
    const canvas = { requestRenderAll: vi.fn(), renderAll: vi.fn() };
    const t = token(300, 200);

    manager(canvas).UpdateTokenUIPositions({ object: t });

    expect(t.additionalObjects[0].left).toBeCloseTo(300);
    expect(t.additionalObjects[0].top).toBeCloseTo(194);
  });

  it('places the bars at their tokens while the tokens are selected together', () => {
    // jsdom has no <canvas>, so no fabric.Canvas: the selection is built on its own.
    const canvas = { requestRenderAll: vi.fn(), renderAll: vi.fn() };
    const a = token(300, 200);
    const b = token(500, 400);
    const selection = new fabric.ActiveSelection([a, b]);
    expect(a.group).toBe(selection); // a's own left/top are now relative to the selection

    const tm = manager(canvas);
    tm.UpdateTokenUIPositions({ object: a });
    tm.UpdateTokenUIPositions({ object: b });

    expect(a.additionalObjects[0].left).toBeCloseTo(300);
    expect(a.additionalObjects[0].top).toBeCloseTo(194);
    expect(b.additionalObjects[0].left).toBeCloseTo(500);
    expect(b.additionalObjects[0].top).toBeCloseTo(394);
  });

  // Status icons ("right-top") are hidden while the token is dragged and shown again
  // after the drop; they're repositioned in between, so they must still line up then.
  const withIcons = (count) => {
    const t = token(300, 200);
    t.additionalObjects = Array.from({ length: count }, () => {
      const icon = new fabric.Rect({ width: 16, height: 16, strokeWidth: 0 });
      icon.tokenData = { anchor: 'right-top', offsetX: 0, offsetY: 0 };
      return icon;
    });
    return t;
  };

  it('lines up status icons side by side', () => {
    const canvas = { requestRenderAll: vi.fn(), renderAll: vi.fn() };
    const t = withIcons(3);

    manager(canvas).UpdateTokenUIPositions({ object: t });

    expect(t.additionalObjects.map((i) => i.left)).toEqual([350, 368, 386]);
  });

  it('keeps status icons lined up when repositioned while hidden for a drag', () => {
    const canvas = { requestRenderAll: vi.fn(), renderAll: vi.fn() };
    const t = withIcons(3);
    t.additionalObjects[1].visible = false; // switched off: no slot
    t.additionalObjects.forEach((i) => i.set({ visibleBeforeDrag: i.visible, visible: false }));

    manager(canvas).UpdateTokenUIPositions({ object: t });

    expect(t.additionalObjects[0].left).toBe(350);
    expect(t.additionalObjects[2].left).toBe(368);
  });

  // More status icons than fit: the first ones, then "…" in the last slot; all of them
  // while the token is selected.
  const shown = (t) =>
    t.additionalObjects.filter((o) => !o.tokenData?.overflowMarker && !o.isNotVisible());
  const marker = (t) => t.additionalObjects.find((o) => o.tokenData?.overflowMarker);

  it('collapses more than 3 status icons into 2 and a "…" marker', () => {
    const canvas = { requestRenderAll: vi.fn(), renderAll: vi.fn(), add: vi.fn() };
    const t = withIcons(5);
    const icons = [...t.additionalObjects];

    manager(canvas).UpdateTokenUIPositions({ object: t });

    expect(shown(t)).toEqual(icons.slice(0, 2));
    expect(marker(t)).toBeDefined();
    expect(canvas.add).toHaveBeenCalledWith(marker(t));
    expect(marker(t).isNotVisible()).toBe(false);
    expect(marker(t).left).toBe(386);
    // Hidden icons can't be clicked either.
    expect(icons[3].containsPoint(new fabric.Point(icons[3].left + 8, icons[3].top + 8))).toBe(false);
  });

  it('shows 3 status icons without a marker', () => {
    const canvas = { requestRenderAll: vi.fn(), renderAll: vi.fn(), add: vi.fn() };
    const t = withIcons(3);

    manager(canvas).UpdateTokenUIPositions({ object: t });

    expect(shown(t)).toHaveLength(3);
    expect(marker(t)?.isNotVisible() ?? true).toBe(true);
  });

  it('shows every status icon while the token is selected, and collapses again after', () => {
    const canvas = { requestRenderAll: vi.fn(), renderAll: vi.fn(), add: vi.fn() };
    const t = withIcons(5);
    const tm = manager(canvas);
    tm.UpdateTokenUIPositions({ object: t });

    t._iconsExpanded = true;
    tm.UpdateTokenUIPositions({ object: t });
    expect(shown(t)).toHaveLength(5);
    expect(marker(t).isNotVisible()).toBe(true);
    expect(t.additionalObjects.filter((o) => o.tokenData?.overflowMarker)).toHaveLength(1);

    t._iconsExpanded = false;
    tm.UpdateTokenUIPositions({ object: t });
    expect(shown(t)).toHaveLength(2);
  });

  it('counts only icons that are turned on', () => {
    const canvas = { requestRenderAll: vi.fn(), renderAll: vi.fn(), add: vi.fn() };
    const t = withIcons(4);
    t.additionalObjects[0].visible = false;

    manager(canvas).UpdateTokenUIPositions({ object: t });

    expect(shown(t)).toHaveLength(3);
  });

  it('lets the token template change how many fit', () => {
    const canvas = { requestRenderAll: vi.fn(), renderAll: vi.fn(), add: vi.fn() };
    const t = withIcons(5);
    t.tokenData = { maxStatusIcons: 5 };

    manager(canvas).UpdateTokenUIPositions({ object: t });

    expect(shown(t)).toHaveLength(5);
  });
});
