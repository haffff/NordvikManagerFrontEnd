import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../../ClientMediator', () => ({ default: { fireEvent: vi.fn() } }));

import { OnDragStartClientBehavior } from './OnDragStart';
import { OnDragMoveClientBehavior } from './OnDragMove';

// Fabric hands the behaviours the raw TouchEvent on a phone: no clientX of its own.
const touch = (type, x, y) => ({ type, touches: [{ clientX: x, clientY: y }], changedTouches: [{ clientX: x, clientY: y }] });
const mouse = (x, y) => ({ type: 'mousedown', clientX: x, clientY: y });

function fakeCanvas(extra = {}) {
  return {
    viewportTransform: [1, 0, 0, 1, 0, 0],
    selection: true,
    getPointer: () => ({ x: 0, y: 0 }),
    requestRenderAll: vi.fn(),
    ...extra,
  };
}

async function drag(canvas, start, move, target = null) {
  await new OnDragStartClientBehavior().Handle({ e: start, target, button: 1 }, canvas, null, 'bm1');
  await new OnDragMoveClientBehavior().Handle({ e: move }, canvas, null, 'bm1');
}

describe('dragging the map by touch', () => {
  it('a finger on the empty map pans it', async () => {
    const canvas = fakeCanvas({ _groupSelector: { ex: 0 } });
    await drag(canvas, touch('touchstart', 10, 10), touch('touchmove', 40, 25));
    expect(canvas.viewportTransform.slice(4)).toEqual([30, 15]);
    expect(canvas._groupSelector).toBeNull(); // no rubber band while panning
  });

  it('a finger on a token it can move leaves the token to fabric', async () => {
    const canvas = fakeCanvas();
    await drag(canvas, touch('touchstart', 10, 10), touch('touchmove', 40, 25), { selectable: true });
    expect(canvas.isDragging).toBeFalsy();
    expect(canvas.viewportTransform.slice(4)).toEqual([0, 0]);
  });

  it('a finger with a map tool on is left to the tool', async () => {
    const canvas = fakeCanvas({ measureMode: true });
    await drag(canvas, touch('touchstart', 10, 10), touch('touchmove', 40, 25));
    expect(canvas.isDragging).toBeFalsy();
  });

  it('the Drag tool pans by touch too, without losing the map to NaN', async () => {
    const canvas = fakeCanvas({ draggingMode: true });
    await drag(canvas, touch('touchstart', 10, 10), touch('touchmove', 40, 25), { selectable: true });
    expect(canvas.viewportTransform.slice(4)).toEqual([30, 15]);
  });

  it('a left mouse drag on the empty map still draws a selection, not a pan', async () => {
    const canvas = fakeCanvas();
    await drag(canvas, mouse(10, 10), { type: 'mousemove', clientX: 40, clientY: 25 });
    expect(canvas.isDragging).toBeFalsy();
  });
});
