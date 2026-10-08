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
});
