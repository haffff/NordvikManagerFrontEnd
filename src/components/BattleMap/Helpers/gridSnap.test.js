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
