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
  const tm = new TokenManager({ getCanvas: () => canvas });
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

  // More status icons than fit: the first ones, then a small "+N" right after them;
  // all of them while the token is selected.
  const shown = (t) =>
    t.additionalObjects.filter((o) => !o.tokenData?.overflowMarker && !o.isNotVisible());
  const marker = (t) => t.additionalObjects.find((o) => o.tokenData?.overflowMarker);
  // jsdom can't measure fabric text, so the label is a 10×10 stand-in here.
  const iconManager = (canvas) => {
    const tm = manager(canvas);
    tm._createOverflowMarker = () => {
      const label = new fabric.Rect({ width: 10, height: 10, strokeWidth: 0 });
      label.tokenData = { anchor: 'right-top', overflowMarker: true };
      return label;
    };
    return tm;
  };
  const iconCanvas = () => ({ requestRenderAll: vi.fn(), renderAll: vi.fn(), add: vi.fn() });

  it('shows 3 status icons and "+2" right after them when there are 5', () => {
    const canvas = iconCanvas();
    const t = withIcons(5);
    const icons = [...t.additionalObjects];

    iconManager(canvas).UpdateTokenUIPositions({ object: t });

    expect(shown(t)).toEqual(icons.slice(0, 3));
    expect(canvas.add).toHaveBeenCalledWith(marker(t));
    expect(marker(t).isNotVisible()).toBe(false);
    expect(marker(t).text).toBe('+2');
    expect(marker(t).left).toBe(404);
    expect(marker(t).top).toBe(203); // centred on the icon row
    // Hidden icons can't be clicked either.
    expect(icons[3].containsPoint(new fabric.Point(icons[3].left + 8, icons[3].top + 8))).toBe(false);
  });

  it('shows 3 status icons without a marker', () => {
    const t = withIcons(3);

    iconManager(iconCanvas()).UpdateTokenUIPositions({ object: t });

    expect(shown(t)).toHaveLength(3);
    expect(marker(t)?.isNotVisible() ?? true).toBe(true);
  });

  it('shows every status icon while the token is selected, and collapses again after', () => {
    const t = withIcons(5);
    const tm = iconManager(iconCanvas());
    tm.UpdateTokenUIPositions({ object: t });

    t._iconsExpanded = true;
    tm.UpdateTokenUIPositions({ object: t });
    expect(shown(t)).toHaveLength(5);
    expect(marker(t).isNotVisible()).toBe(true);
    expect(t.additionalObjects.filter((o) => o.tokenData?.overflowMarker)).toHaveLength(1);

    t._iconsExpanded = false;
    tm.UpdateTokenUIPositions({ object: t });
    expect(shown(t)).toHaveLength(3);
  });

  it('updates the count when icons change', () => {
    const t = withIcons(5);
    const tm = iconManager(iconCanvas());
    tm.UpdateTokenUIPositions({ object: t });

    t.additionalObjects[4].visible = false;
    tm.UpdateTokenUIPositions({ object: t });

    expect(marker(t).text).toBe('+1');
  });

  it('counts only icons that are turned on', () => {
    const t = withIcons(4);
    t.additionalObjects[0].visible = false;

    iconManager(iconCanvas()).UpdateTokenUIPositions({ object: t });

    expect(shown(t)).toHaveLength(3);
    expect(marker(t)?.isNotVisible() ?? true).toBe(true);
  });

  // An icon set moved off the top-right corner (tokenData.stack): its icons, all at the
  // same offset, still line up there instead of piling onto one spot.
  const stackedAt = (anchor, count, offsetX = 0, offsetY = 0) => {
    const t = withIcons(count);
    t.additionalObjects.forEach((i) => { i.tokenData = { anchor, offsetX, offsetY, stack: true }; });
    return t;
  };

  it('lines up stacked icons at any anchor, from their own offset', () => {
    const t = stackedAt('left-bottom', 3, 4, 2);

    manager(iconCanvas()).UpdateTokenUIPositions({ object: t });

    expect(t.additionalObjects.map((i) => i.left)).toEqual([304, 322, 340]);
    expect(t.additionalObjects.map((i) => i.top)).toEqual([252, 252, 252]);
  });

  it('collapses each anchor\'s stack on its own, "+N" right after it', () => {
    const t = stackedAt('left-bottom', 5);
    const rt = withIcons(2).additionalObjects;
    t.additionalObjects.push(...rt);

    iconManager(iconCanvas()).UpdateTokenUIPositions({ object: t });

    expect(shown(t)).toHaveLength(5); // 3 bottom-left + both top-right
    expect(marker(t).text).toBe('+2');
    expect(marker(t).left).toBe(354);
    expect(rt.map((i) => i.left)).toEqual([350, 368]);
  });

  it('leaves parts that don\'t stack at their own offsets', () => {
    const t = stackedAt('left-bottom', 2);
    t.additionalObjects.forEach((i) => { delete i.tokenData.stack; });

    manager(iconCanvas()).UpdateTokenUIPositions({ object: t });

    expect(t.additionalObjects.map((i) => i.left)).toEqual([300, 300]);
  });

  it('lets the token template change how many fit', () => {
    const t = withIcons(5);
    t.tokenData = { maxStatusIcons: 4 };

    iconManager(iconCanvas()).UpdateTokenUIPositions({ object: t });

    expect(shown(t)).toHaveLength(4);
    expect(marker(t).text).toBe('+1');
  });
});

// A part with tokenData.fitToToken (e.g. a ring around the token) is as wide as the
// token is shown, whatever its size on the map, and keeps its aspect.
describe('TokenManager.UpdateTokenUIPositions: fitToToken', () => {
  const ringed = (side, scale = 1) => {
    const t = new fabric.Rect({ left: 100, top: 100, width: side, height: side, strokeWidth: 0, scaleX: scale, scaleY: scale });
    const ring = new fabric.Circle({ radius: 25, strokeWidth: 0, originX: 'center', originY: 'center' });
    ring.tokenData = { anchor: 'center', fitToToken: true };
    t.additionalObjects = [ring];
    return { t, ring };
  };

  it('scales the part to a 2×2 token', () => {
    const { t, ring } = ringed(100);
    manager({ requestRenderAll: vi.fn() }).UpdateTokenUIPositions({ object: t });
    expect(ring.getScaledWidth()).toBeCloseTo(100);
    expect(ring.scaleY).toBeCloseTo(ring.scaleX);
    expect([ring.left, ring.top]).toEqual([150, 150]);
  });

  it('follows the token\'s own scale', () => {
    const { t, ring } = ringed(200, 0.5);
    manager({ requestRenderAll: vi.fn() }).UpdateTokenUIPositions({ object: t });
    expect(ring.getScaledWidth()).toBeCloseTo(100);
  });

  it('leaves other parts at their own size', () => {
    const { t } = ringed(100);
    const bar = new fabric.Rect({ width: 40, height: 4, strokeWidth: 0 });
    bar.tokenData = { anchor: 'bottom' };
    t.additionalObjects.push(bar);
    manager({ requestRenderAll: vi.fn() }).UpdateTokenUIPositions({ object: t });
    expect(bar.scaleX).toBe(1);
  });
});
