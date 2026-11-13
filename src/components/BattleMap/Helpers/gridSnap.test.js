import { describe, it, expect } from 'vitest';
import { snapScaledBox } from './gridSnap';

const grid = 50;

// A box being resized: the edges that move land on grid lines, the others stay put.
describe('snapScaledBox', () => {
  it.each([
    ['dragging the bottom-right corner snaps the right and bottom edges',
      { left: 100, top: 100, width: 130, height: 70 }, { moveX: 'right', moveY: 'bottom' }, { left: 100, top: 100, width: 150, height: 50 }],
    // right edge 230, bottom 170 stay
    ['dragging the top-left corner snaps the left and top edges; the far corner stays',
      { left: 81, top: 128, width: 149, height: 42 }, { moveX: 'left', moveY: 'top' }, { left: 100, top: 150, width: 130, height: 20 }],
    ['a side handle only snaps its own edge',
      { left: 100, top: 100, width: 130, height: 70 }, { moveX: 'right', moveY: null }, { left: 100, top: 100, width: 150, height: 70 }],
    ['scaling from the centre snaps both edges',
      { left: 90, top: 100, width: 120, height: 50 }, { moveX: 'both', moveY: null }, { left: 100, top: 100, width: 100, height: 50 }],
    ['a moving edge that would reach the fixed one stops a grid line short of it (right, bottom)',
      { left: 100, top: 100, width: 10, height: 10 }, { moveX: 'right', moveY: 'bottom' }, { left: 100, top: 100, width: 50, height: 50 }],
    ['a moving edge that would reach the fixed one stops a grid line short of it (left)',
      { left: 140, top: 100, width: 10, height: 50 }, { moveX: 'left', moveY: null }, { left: 100, top: 100, width: 50, height: 50 }],
  ])('%s', (_name, box, handles, expected) => {
    expect(snapScaledBox(box, { gridSize: grid, ...handles })).toEqual(expected);
  });
});

// Corner scaling keeps the proportions: one side snaps to the grid, the other follows.
describe('snapScaledBox, keeping proportions', () => {
  it.each([
    ['a square stays square',
      { left: 100, top: 100, width: 130, height: 130 }, { moveX: 'right', moveY: 'bottom' }, { left: 100, top: 100, width: 150, height: 150 }],
    // 2:1 — width 190 → 200 (5%), height 95 → 100 (5%) both fine; width 170 → 150 (12%) vs height 85 → 100 (18%)
    ['snaps the side that needs the smaller change; the other follows the proportions',
      { left: 0, top: 0, width: 170, height: 85 }, { moveX: 'right', moveY: 'bottom' }, { left: 0, top: 0, width: 150, height: 75 }],
    // right 230, bottom 230 fixed; the left edge 90 snaps to 100 → 130x130
    ['dragging the top-left corner keeps the bottom-right corner',
      { left: 90, top: 90, width: 140, height: 140 }, { moveX: 'left', moveY: 'top' }, { left: 100, top: 100, width: 130, height: 130 }],
  ])('%s', (_name, box, handles, expected) => {
    expect(snapScaledBox(box, { gridSize: grid, ...handles, keepRatio: true })).toEqual(expected);
  });

  it('scaling from the centre keeps the centre', () => {
    const box = snapScaledBox({ left: 80, top: 80, width: 140, height: 140 }, { gridSize: grid, moveX: 'both', moveY: 'both', keepRatio: true });
    expect(box.width).toBe(box.height);
    expect(box.left + box.width / 2).toBeCloseTo(150);
    expect(box.top + box.height / 2).toBeCloseTo(150);
  });
});
