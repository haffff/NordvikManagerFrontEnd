import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clampZoom, createTouchGestures, pinchStep, touchPans, touchPoint } from './touchGestures';

// A canvas with just the viewport fabric keeps: [zoom, 0, 0, zoom, panX, panY].
function fakeCanvas(extra = {}) {
  return {
    viewportTransform: [1, 0, 0, 1, 0, 0],
    getZoom() { return this.viewportTransform[0]; },
    requestRenderAll: vi.fn(),
    setViewportTransform: vi.fn(),
    ...extra,
  };
}
const rect = () => ({ left: 100, top: 50 });

describe('touchPoint', () => {
  it('reads a touch event from its first touch, then its changed touch, else the event', () => {
    expect(touchPoint({ touches: [{ clientX: 1, clientY: 2 }] })).toEqual({ x: 1, y: 2 });
    expect(touchPoint({ touches: [], changedTouches: [{ clientX: 3, clientY: 4 }] })).toEqual({ x: 3, y: 4 });
    expect(touchPoint({ clientX: 5, clientY: 6 })).toEqual({ x: 5, y: 6 });
  });
});

describe('touchPans', () => {
  it('pans a finger on the empty map, not one on a token it can move', () => {
    expect(touchPans(fakeCanvas(), null)).toBe(true);
    expect(touchPans(fakeCanvas(), { selectable: false })).toBe(true);
    expect(touchPans(fakeCanvas(), { selectable: true })).toBe(false);
  });

  it.each([
    'measureMode', 'freeDrawMode', 'isDrawingMode', 'simpleCreateMode', 'editGridMode',
    'tokenSelectMode', 'actionTool', 'pickPoint', 'pickTargets',
  ])('leaves the press to the tool while %s is on', (flag) => {
    expect(touchPans(fakeCanvas({ [flag]: flag === 'actionTool' ? { name: 'x' } : true }), null)).toBe(false);
  });
});

describe('pinchStep', () => {
  it('scales by how far apart the fingers went and follows their midpoint', () => {
    const step = pinchStep([{ x: 0, y: 0 }, { x: 100, y: 0 }], [{ x: 10, y: 20 }, { x: 210, y: 20 }]);
    expect(step.scale).toBeCloseTo(2);
    expect(step.center).toEqual({ x: 110, y: 20 });
    expect(step.pan).toEqual({ x: 60, y: 20 });
  });

  it('does not scale when the fingers start on the same spot', () => {
    expect(pinchStep([{ x: 5, y: 5 }, { x: 5, y: 5 }], [{ x: 5, y: 5 }, { x: 50, y: 5 }]).scale).toBe(1);
  });
});

describe('clampZoom', () => {
  it('stays within the wheel zoom range', () => {
    expect(clampZoom(20)).toBe(10);
    expect(clampZoom(0.001)).toBe(0.01);
    expect(clampZoom(2)).toBe(2);
  });
});

describe('createTouchGestures', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('two fingers zoom about their midpoint and move the map with it', () => {
    const canvas = fakeCanvas();
    const g = createTouchGestures({ canvas, rect });
    g.down(1, 100, 50);
    g.down(2, 200, 50);
    expect(g.isPinching()).toBe(true);
    // Spread apart around the same midpoint (150, 50 on screen = 50, 0 on the canvas).
    expect(g.move(2, 250, 50)).toBe(true);
    g.move(1, 50, 50);
    expect(canvas.getZoom()).toBeCloseTo(2);
    // The canvas point under the midpoint stays under it.
    const [z, , , , px, py] = canvas.viewportTransform;
    expect((50 - px) / z).toBeCloseTo(50);
    expect((0 - py) / z).toBeCloseTo(0);
    expect(canvas.requestRenderAll).toHaveBeenCalled();
  });

  it('two fingers moving together pan the map', () => {
    const canvas = fakeCanvas();
    const g = createTouchGestures({ canvas, rect });
    g.down(1, 100, 100);
    g.down(2, 200, 100);
    g.move(1, 130, 140);
    g.move(2, 230, 140);
    expect(canvas.getZoom()).toBeCloseTo(1);
    expect(canvas.viewportTransform[4]).toBeCloseTo(30);
    expect(canvas.viewportTransform[5]).toBeCloseTo(40);
  });

  it('commits the viewport once the pinch ends, and swallows the last finger until it lifts', () => {
    const canvas = fakeCanvas();
    const g = createTouchGestures({ canvas, rect });
    g.down(1, 0, 0);
    g.down(2, 100, 0);
    g.move(2, 200, 0);
    g.up(2);
    expect(canvas.setViewportTransform).toHaveBeenCalledTimes(1);
    expect(canvas.setViewportTransform).toHaveBeenCalledWith(canvas.viewportTransform);
    expect(g.isPinching()).toBe(true); // finger 1 still down: it must not drag a token now
    expect(g.move(1, 40, 0)).toBe(true);
    g.up(1);
    expect(g.isPinching()).toBe(false);
    expect(canvas.setViewportTransform).toHaveBeenCalledTimes(1);
  });

  it('a second finger stops what the first one started: a pan, a rubber band, a token drag', () => {
    const token = { left: 40, top: 40, set(v) { Object.assign(this, v); }, setCoords: vi.fn() };
    const canvas = fakeCanvas({
      isDragging: true,
      _groupSelector: { ex: 0 },
      _currentTransform: { target: token, original: { left: 10, top: 20 } },
    });
    token.left = 55;
    const g = createTouchGestures({ canvas, rect });
    g.down(1, 0, 0);
    g.down(2, 100, 0);
    expect(canvas.isDragging).toBe(false);
    expect(canvas._groupSelector).toBeNull();
    expect(canvas._currentTransform).toBeNull();
    expect(token).toMatchObject({ left: 10, top: 20 });
    expect(token.setCoords).toHaveBeenCalled();
  });

  it('a finger held still opens the menu where it is', () => {
    const onLongPress = vi.fn();
    const g = createTouchGestures({ canvas: fakeCanvas(), rect, onLongPress, longPressMs: 500 });
    g.down(1, 120, 80);
    g.move(1, 124, 83); // a resting finger jitters
    vi.advanceTimersByTime(499);
    expect(onLongPress).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onLongPress).toHaveBeenCalledWith({ x: 120, y: 80 });
  });

  it('no menu once the finger moves away, lifts, or a second finger lands', () => {
    const onLongPress = vi.fn();
    const g = createTouchGestures({ canvas: fakeCanvas(), rect, onLongPress, longPressMs: 500 });
    g.down(1, 0, 0);
    g.move(1, 30, 0);
    vi.advanceTimersByTime(600);
    g.up(1);

    g.down(2, 0, 0);
    g.up(2);
    vi.advanceTimersByTime(600);

    g.down(3, 0, 0);
    g.down(4, 50, 0);
    vi.advanceTimersByTime(600);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('one finger alone is left to the map (moves are not taken)', () => {
    const g = createTouchGestures({ canvas: fakeCanvas(), rect });
    g.down(1, 0, 0);
    expect(g.move(1, 50, 0)).toBe(false);
    expect(g.move(9, 50, 0)).toBe(false); // a finger it never saw
  });
});

describe('openContextMenuAt', () => {
  it("sends a right click at the point to the map's menu trigger", async () => {
    const { openContextMenuAt } = await import('./touchGestures');
    const trigger = document.createElement('div');
    const seen = vi.fn();
    document.body.appendChild(trigger);
    document.body.addEventListener('contextmenu', (e) => seen({ x: e.clientX, y: e.clientY, target: e.target }));
    openContextMenuAt(trigger, { x: 12, y: 34 });
    expect(seen).toHaveBeenCalledWith({ x: 12, y: 34, target: trigger });
    trigger.remove();
  });
});
