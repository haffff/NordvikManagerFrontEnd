import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../helpers/transport', () => ({ ActiveTransportManager: { Send: vi.fn() } }));
vi.mock('../../../ClientMediator', () => ({ default: { sendCommand: vi.fn() } }));

import GridFactoryInstance, { visibleGridLines } from './GridFactory';

// The grid used to be one Fabric line object per grid line, all redrawn on every frame
// (pan, zoom, token drag) — on or off screen. It's now one object drawing only the
// lines in view, as a single path.

describe('visibleGridLines', () => {
  it('lists every line, borders included, when the whole map is in view', () => {
    const { xs, ys } = visibleGridLines({ width: 100, height: 50, gridSize: 25 });
    expect(xs).toEqual([0, 25, 50, 75, 100]);
    expect(ys).toEqual([0, 25, 50]);
  });

  it('only the lines in view when zoomed in', () => {
    const { xs, ys, from, to } = visibleGridLines({
      width: 10000, height: 10000, gridSize: 50,
      view: { left: 1020, top: 480, right: 1230, bottom: 610 },
    });
    expect(xs).toEqual([1050, 1100, 1150, 1200]);
    expect(ys).toEqual([500, 550, 600]);
    expect(from).toEqual({ x: 1020, y: 480 });
    expect(to).toEqual({ x: 1230, y: 610 });
  });

  it('the map border is drawn even when it is not on the grid size', () => {
    const { xs } = visibleGridLines({ width: 110, height: 50, gridSize: 25 });
    expect(xs).toEqual([0, 25, 50, 75, 100, 110]);
  });

  it('nothing when the map is out of view', () => {
    const { xs, ys } = visibleGridLines({ width: 100, height: 100, gridSize: 25, view: { left: 300, top: 0, right: 500, bottom: 100 } });
    expect(xs).toEqual([]);
    expect(ys).toEqual([]);
  });
});

describe('GridFactory.DrawGrid', () => {
  const recordingCtx = () => {
    const calls = { moveTo: 0, stroke: 0 };
    return {
      calls,
      save() {}, restore() {}, beginPath() {}, lineTo() {},
      moveTo() { calls.moveTo++; },
      stroke() { calls.stroke++; },
    };
  };

  it('is one object, still the ".grid" the rest of the map looks for', () => {
    const grid = GridFactoryInstance.DrawGrid(50, [2000, 1000], 'map-1', 'red');
    expect(grid.name).toBe('.grid');
    expect(grid.width).toBe(2000);
    expect(grid.height).toBe(1000);
    expect(grid._objects).toBeUndefined(); // no child line per grid line
    expect(grid.controls.changeGrid).toBeDefined();
    expect(grid.controls.changeGridSize).toBeDefined();
  });

  it('draws the lines in view with one stroke', () => {
    const grid = GridFactoryInstance.DrawGrid(50, [10000, 10000], 'map-1', 'red');
    grid.canvas = { vptCoords: { tl: { x: 0, y: 0 }, br: { x: 500, y: 300 } } };
    const ctx = recordingCtx();

    grid._render(ctx);

    expect(ctx.calls.stroke).toBe(1);
    expect(ctx.calls.moveTo).toBe(11 + 7); // x 0..500, y 0..300 every 50
  });
});
