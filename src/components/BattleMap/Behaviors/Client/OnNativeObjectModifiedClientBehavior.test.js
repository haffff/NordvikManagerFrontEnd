import { vi, describe, it, expect } from 'vitest';

vi.mock('../../../../ClientMediator', () => ({
  default: { sendCommandAsync: vi.fn() },
}));

const sendMock = vi.fn();
vi.mock('../../../../helpers/transport', () => ({
  ActiveTransportManager: { Send: (...args) => sendMock(...args) },
}));

vi.mock('../../DTOConverter', () => ({
  default: {
    ConvertToDTOMinified: (object) => ({ id: object.id, left: object.left, top: object.top }),
    ConvertToDTO: (object) => ({ id: object.id }),
  },
}));

import { OnNativeObjectModifiedClientBehavior } from './OnNativeObjectModifiedClientBehavior';

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
