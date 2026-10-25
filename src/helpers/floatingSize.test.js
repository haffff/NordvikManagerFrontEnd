import { describe, it, expect } from 'vitest';
import { fitFloatingSize, MAX_SCREEN_SHARE } from './floatingSize';

// A floating window that sizes itself to its content (a battle map to its map) opens at most
// 4/5 of the screen, so its edges stay reachable for resizing.
describe('fitFloatingSize', () => {
  const screen = { width: 1600, height: 900 };

  it('keeps a size that fits', () => {
    expect(fitFloatingSize(800, 600, screen)).toEqual({ width: 800, height: 600 });
  });

  it('caps each side at 4/5 of the screen', () => {
    expect(MAX_SCREEN_SHARE).toBe(0.8);
    expect(fitFloatingSize(4000, 3000, screen)).toEqual({ width: 1280, height: 720 });
    expect(fitFloatingSize(1000, 3000, screen)).toEqual({ width: 1000, height: 720 });
  });

  it('never goes below a usable minimum, even on a tiny screen', () => {
    expect(fitFloatingSize(4000, 3000, { width: 200, height: 150 })).toEqual({ width: 240, height: 180 });
  });

  it('uses the browser window by default', () => {
    const { width, height } = fitFloatingSize(100000, 100000);
    expect(width).toBe(Math.round(window.innerWidth * 0.8));
    expect(height).toBe(Math.round(window.innerHeight * 0.8));
  });
});
