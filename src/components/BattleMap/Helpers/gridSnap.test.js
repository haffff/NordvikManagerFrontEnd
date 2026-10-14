import { describe, it, expect } from 'vitest';
import { snapScaledBox } from './gridSnap';

// A box being resized: the edges that move land on grid lines, the others stay put.
describe('snapScaledBox', () => {
  const grid = 50;

  it('dragging the bottom-right corner snaps the right and bottom edges', () => {
    expect(snapScaledBox({ left: 100, top: 100, width: 130, height: 70 }, { gridSize: grid, moveX: 'right', moveY: 'bottom' }))
      .toEqual({ left: 100, top: 100, width: 150, height: 50 });
  });

  it('dragging the top-left corner snaps the left and top edges; the far corner stays', () => {
    // right edge 230, bottom 170 stay
    expect(snapScaledBox({ left: 81, top: 128, width: 149, height: 42 }, { gridSize: grid, moveX: 'left', moveY: 'top' }))
      .toEqual({ left: 100, top: 150, width: 130, height: 20 });
  });

  it('a side handle only snaps its own edge', () => {
    expect(snapScaledBox({ left: 100, top: 100, width: 130, height: 70 }, { gridSize: grid, moveX: 'right', moveY: null }))
      .toEqual({ left: 100, top: 100, width: 150, height: 70 });
  });

  it('scaling from the centre snaps both edges', () => {
    expect(snapScaledBox({ left: 90, top: 100, width: 120, height: 50 }, { gridSize: grid, moveX: 'both', moveY: null }))
      .toEqual({ left: 100, top: 100, width: 100, height: 50 });
  });

  it('a moving edge that would reach the fixed one stops a grid line short of it', () => {
    expect(snapScaledBox({ left: 100, top: 100, width: 10, height: 10 }, { gridSize: grid, moveX: 'right', moveY: 'bottom' }))
      .toEqual({ left: 100, top: 100, width: 50, height: 50 });
    expect(snapScaledBox({ left: 140, top: 100, width: 10, height: 50 }, { gridSize: grid, moveX: 'left', moveY: null }))
      .toEqual({ left: 100, top: 100, width: 50, height: 50 });
  });
});

// Corner scaling keeps the proportions: one side snaps to the grid, the other follows.
describe('snapScaledBox, keeping proportions', () => {
  const grid = 50;

  it('a square stays square', () => {
    expect(snapScaledBox({ left: 100, top: 100, width: 130, height: 130 }, { gridSize: grid, moveX: 'right', moveY: 'bottom', keepRatio: true }))
      .toEqual({ left: 100, top: 100, width: 150, height: 150 });
  });

  it('snaps the side that needs the smaller change; the other follows the proportions', () => {
    // 2:1 — width 190 → 200 (5%), height 95 → 100 (5%) both fine; width 170 → 150 (12%) vs height 85 → 100 (18%)
    const box = snapScaledBox({ left: 0, top: 0, width: 170, height: 85 }, { gridSize: grid, moveX: 'right', moveY: 'bottom', keepRatio: true });
    expect(box).toEqual({ left: 0, top: 0, width: 150, height: 75 });
  });

  it('dragging the top-left corner keeps the bottom-right corner', () => {
    // right 230, bottom 230 fixed; the left edge 90 snaps to 100 → 130x130
    expect(snapScaledBox({ left: 90, top: 90, width: 140, height: 140 }, { gridSize: grid, moveX: 'left', moveY: 'top', keepRatio: true }))
      .toEqual({ left: 100, top: 100, width: 130, height: 130 });
  });

  it('scaling from the centre keeps the centre', () => {
    const box = snapScaledBox({ left: 80, top: 80, width: 140, height: 140 }, { gridSize: grid, moveX: 'both', moveY: 'both', keepRatio: true });
    expect(box.width).toBe(box.height);
    expect(box.left + box.width / 2).toBeCloseTo(150);
    expect(box.top + box.height / 2).toBeCloseTo(150);
  });
});
