import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { useCanvasFitsPanel } from './useCanvasFitsPanel';

// The battlemap sized its canvas during render, so it depended on being re-rendered
// on every dock commit (every click anywhere). The size now follows the panel's own
// width/height in an effect, so the battlemap only needs to render when those change.
describe('useCanvasFitsPanel', () => {
  const canvas = () => ({ setDimensions: vi.fn() });

  it('sizes the canvas to the panel', () => {
    const c = canvas();

    renderHook(() => useCanvasFitsPanel(c, 640, 480, true));

    expect(c.setDimensions).toHaveBeenCalledWith({ width: 640, height: 480 });
  });

  it('follows a resize, and does nothing while the size is unchanged', () => {
    const c = canvas();
    const { rerender } = renderHook(({ w, h }) => useCanvasFitsPanel(c, w, h, true), { initialProps: { w: 640, h: 480 } });

    rerender({ w: 640, h: 480 });
    expect(c.setDimensions).toHaveBeenCalledTimes(1);

    rerender({ w: 800, h: 480 });
    expect(c.setDimensions).toHaveBeenLastCalledWith({ width: 800, height: 480 });
    expect(c.setDimensions).toHaveBeenCalledTimes(2);
  });

  it('waits until the canvas exists and the map is loaded', () => {
    const c = canvas();
    const { rerender } = renderHook(({ cv, ready }) => useCanvasFitsPanel(cv, 640, 480, ready), {
      initialProps: { cv: undefined, ready: false },
    });

    rerender({ cv: c, ready: false });
    expect(c.setDimensions).not.toHaveBeenCalled();

    rerender({ cv: c, ready: true });
    expect(c.setDimensions).toHaveBeenCalledWith({ width: 640, height: 480 });
  });
});
