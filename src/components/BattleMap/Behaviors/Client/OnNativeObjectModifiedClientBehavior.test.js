import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../../ClientMediator', () => ({
  default: { sendCommandAsync: vi.fn() },
}));

const sendMock = vi.fn();
vi.mock('../../../../helpers/transport', () => ({
  ActiveTransportManager: { Send: (...args) => sendMock(...args) },
}));

vi.mock('../../DTOConverter', () => ({
  default: {
    ConvertToDTOMinified: (object, fields) => ({ id: object.id, ...Object.fromEntries(fields.map((f) => [f, object[f]])) }),
    ConvertToDTO: (object) => ({ id: object.id }),
  },
}));

import { OnNativeObjectModifiedClientBehavior } from './OnNativeObjectModifiedClientBehavior';
import { setSnapSetting } from '../../../../helpers/mapSnapSettings';

// Regression coverage: the isBeingDragged echo-suppression flag that
// OnUpdateElementBehavior reads was never SET anywhere, so its "skip re-animating
// my own drag echo" branch could never activate. This is the client-side half —
// the drag-confirmation send (object:modified with a "drag" transform action)
// must flag the object before sending, so the echo can be recognised as its own.
describe('OnNativeObjectModifiedClientBehavior — isBeingDragged flagging', () => {
  it('sets isBeingDragged on the target for a "drag" action before sending the update', () => {
    const target = { id: 't1', left: 100, top: 200, type: 'rect' };
    const event = { target, transform: { action: 'drag' } };
    const canvas = { discardActiveObject: vi.fn(), getActiveObjects: vi.fn() };
    const map = { gridVisible: false };

    new OnNativeObjectModifiedClientBehavior().Handle(event, canvas, map, 'bm-1');

    expect(target.isBeingDragged).toBe(true);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'element_update', battleMapId: 'bm-1', action: 'drag' })
    );
  });

  it('does not set isBeingDragged for a non-drag action (e.g. scale)', () => {
    const target = { id: 't1', left: 100, top: 200, scaleX: 2, scaleY: 2, type: 'rect' };
    const event = { target, transform: { action: 'scale' } };
    const canvas = { discardActiveObject: vi.fn(), getActiveObjects: vi.fn() };
    const map = { gridVisible: false };

    new OnNativeObjectModifiedClientBehavior().Handle(event, canvas, map, 'bm-1');

    expect(target.isBeingDragged).toBeUndefined();
  });
});

// Snapping to the grid on release: moving snaps unless Alt is held, scaling snaps the
// dragged edges onto grid lines while Ctrl is held (both configurable).
describe('OnNativeObjectModifiedClientBehavior — grid snapping', () => {
  const map = { gridVisible: true, gridSize: 50 };
  const canvas = () => ({ alignMode: 'corners', discardActiveObject: vi.fn(), getActiveObjects: vi.fn() });
  const rect = (props) => ({
    id: 'r1', type: 'rect', originX: 'left', originY: 'top', angle: 0, width: 100, height: 100, scaleX: 1, scaleY: 1,
    set(values) { Object.assign(this, values); }, setCoords: vi.fn(), ...props,
  });
  const run = (target, transform, keys = {}) => {
    sendMock.mockClear();
    new OnNativeObjectModifiedClientBehavior().Handle({ target, transform, e: keys }, canvas(), map, 'bm-1');
    return sendMock.mock.calls.at(-1)?.[0];
  };
  const sentElement = (cmd) => JSON.parse(JSON.stringify(cmd)).data ?? cmd;

  beforeEach(() => localStorage.clear());

  it('moving snaps to the grid, and not while Alt is held', () => {
    const moved = rect({ left: 61, top: 140 });
    run(moved, { action: 'drag' });
    expect([moved.left, moved.top]).toEqual([50, 150]);

    const free = rect({ left: 61, top: 140 });
    run(free, { action: 'drag' }, { altKey: true });
    expect([free.left, free.top]).toEqual([61, 140]);
  });

  it('scaling does not snap unless Ctrl is held', () => {
    const target = rect({ left: 100, top: 100, scaleX: 1.3, scaleY: 0.7 });
    run(target, { action: 'scale', originX: 'left', originY: 'top' });
    expect([target.left, target.top, target.scaleX, target.scaleY]).toEqual([100, 100, 1.3, 0.7]);
  });

  it('scaling with Ctrl snaps the dragged corner onto the grid and sends size and position', () => {
    const target = rect({ left: 100, top: 100, scaleX: 1.3, scaleY: 1.3 });
    const cmd = run(target, { action: 'scale', originX: 'left', originY: 'top' }, { ctrlKey: true });

    expect([target.left, target.top, target.scaleX, target.scaleY]).toEqual([100, 100, 1.5, 1.5]);
    expect(JSON.stringify(cmd)).toContain('"scaleX":1.5');
    expect(JSON.stringify(cmd)).toContain('"left":100');
  });

  it('scaling from the top-left corner keeps the bottom-right corner where it was', () => {
    // right edge 230, bottom edge 230 — fixed
    const target = rect({ left: 90, top: 90, scaleX: 1.4, scaleY: 1.4 });
    run(target, { action: 'scale', originX: 'right', originY: 'bottom' }, { ctrlKey: true });

    expect([target.left, target.top]).toEqual([100, 100]);
    expect(target.left + target.width * target.scaleX).toBeCloseTo(230);
    expect(target.top + target.height * target.scaleY).toBeCloseTo(230);
  });

  it('a corner keeps the image proportions instead of snapping each side (no eggs)', () => {
    const image = rect({ type: 'image', left: 0, top: 0, width: 200, height: 100, scaleX: 1.2, scaleY: 1.2 }); // 240x120
    run(image, { action: 'scale', originX: 'left', originY: 'top' }, { ctrlKey: true });

    // the width snaps (240 → 250, a smaller change than 120 → 100); the height follows
    expect(image.scaleX).toBeCloseTo(1.25);
    expect(image.scaleY).toBeCloseTo(1.25);
  });

  // The scale only means something together with the size it scales: a token whose
  // image came from a property was saved with the placeholder's size, so the scale
  // alone would be applied to that on reload and the token would shrink.
  it('scaling saves the size the scale applies to', () => {
    const token = rect({ type: 'image', left: 0, top: 0, width: 1000, height: 1000, scaleX: 0.5, scaleY: 0.5 });
    const cmd = run(token, { action: 'scale', originX: 'left', originY: 'top' });
    expect(sentElement(cmd)).toMatchObject({ width: 1000, height: 1000, scaleX: 0.5, scaleY: 0.5 });
  });

  it('a side handle only snaps its own edge', () => {
    const target = rect({ left: 100, top: 100, scaleX: 1.3, scaleY: 0.7 });
    run(target, { action: 'scaleX', originX: 'left', originY: 'center' }, { ctrlKey: true });
    expect([target.scaleX, target.scaleY]).toEqual([1.5, 0.7]);
  });

  it('rotating does not move the element onto the grid', () => {
    const target = rect({ left: 61, top: 140, angle: 15 });
    run(target, { action: 'rotate' });
    expect([target.left, target.top]).toEqual([61, 140]);
  });

  it('a rotated element is scaled freely', () => {
    const target = rect({ left: 100, top: 100, scaleX: 1.3, scaleY: 0.7, angle: 30 });
    run(target, { action: 'scale', originX: 'left', originY: 'top' }, { ctrlKey: true });
    expect([target.scaleX, target.scaleY]).toEqual([1.3, 0.7]);
  });

  it('follows the configured keys and modes', () => {
    setSnapSetting('move', { mode: 'never', key: 'Alt' });
    setSnapSetting('scale', { mode: 'always', key: 'Shift' });

    const moved = rect({ left: 61, top: 140 });
    run(moved, { action: 'drag' });
    expect([moved.left, moved.top]).toEqual([61, 140]);

    const scaled = rect({ left: 100, top: 100, scaleX: 1.3, scaleY: 1.3 });
    run(scaled, { action: 'scale', originX: 'left', originY: 'top' });
    expect([scaled.scaleX, scaled.scaleY]).toEqual([1.5, 1.5]);

    const free = rect({ left: 100, top: 100, scaleX: 1.3, scaleY: 0.7 });
    run(free, { action: 'scale', originX: 'left', originY: 'top' }, { shiftKey: true });
    expect([free.scaleX, free.scaleY]).toEqual([1.3, 0.7]);
  });
});
