import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useDockFollowsItsBox } from './useDockFollowsItsBox';

// The dock library measures its box only when it mounts and on a window resize. When the
// toolbar or the status bar changes height (the status bar is taller while connecting),
// the dock kept its old size: a dark strip above the status bar, or panels under it.
describe('useDockFollowsItsBox', () => {
  let observers;
  const OriginalObserver = window.ResizeObserver;

  beforeEach(() => {
    observers = [];
    window.ResizeObserver = class {
      constructor(callback) { this.callback = callback; this.observed = []; observers.push(this); }
      observe(el) { this.observed.push(el); }
      disconnect() { this.disconnected = true; }
    };
  });
  afterEach(() => { window.ResizeObserver = OriginalObserver; });

  it('re-measures the dock whenever its box has a new size', () => {
    const box = document.createElement('div');
    const onResize = vi.fn();
    window.addEventListener('resize', onResize);

    renderHook(() => useDockFollowsItsBox(box));
    expect(observers[0].observed).toEqual([box]);

    observers[0].callback([{ contentRect: { width: 800, height: 600 } }]);
    expect(onResize).toHaveBeenCalledTimes(1);

    observers[0].callback([{ contentRect: { width: 800, height: 640 } }]);
    expect(onResize).toHaveBeenCalledTimes(2);

    observers[0].callback([{ contentRect: { width: 800, height: 640 } }]);
    expect(onResize).toHaveBeenCalledTimes(2);
    window.removeEventListener('resize', onResize);
  });

  it('stops watching on unmount', () => {
    const { unmount } = renderHook(() => useDockFollowsItsBox(document.createElement('div')));
    unmount();
    expect(observers[0].disconnected).toBe(true);
  });
});
