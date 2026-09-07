import { vi, describe, it, expect, beforeEach } from 'vitest';

const { clientMediatorMock, convertFromDTOMock } = vi.hoisted(() => ({
  clientMediatorMock: {
    sendCommandWaitForRegister: vi.fn(),
    sendCommand: vi.fn(),
    sendCommandAsync: vi.fn(),
  },
  convertFromDTOMock: vi.fn(),
}));
vi.mock('../../../../ClientMediator', () => ({ default: clientMediatorMock }));
vi.mock('../../DTOConverter', () => ({ default: { ConvertFromDTO: (...args) => convertFromDTOMock(...args) } }));

import { OnUpdateElementBehavior } from './OnUpdateElementBehavior';

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('OnUpdateElementBehavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clientMediatorMock.sendCommandWaitForRegister.mockResolvedValue({ id: 'player-1' });
  });

  // Regression coverage (isBeingDragged consumption): the flag set by
  // OnNativeObjectModifiedClientBehavior must be recognised and cleared here so
  // the object's own drag-confirmation echo doesn't get re-animated (which risked
  // a token-UI hide/restore race under rapid successive drags).
  describe('own-drag echo suppression', () => {
    it('consumes isBeingDragged and skips re-animating the object', async () => {
      const obj = { id: 'obj-1', isBeingDragged: true, set: vi.fn(), animate: vi.fn() };
      const canvas = { getObjects: () => [obj], requestRenderAll: vi.fn() };
      const response = { data: { id: 'obj-1' }, battleMapId: 'bm-1', playerId: 'player-1', action: 'drag' };

      await new OnUpdateElementBehavior().Handle(response, canvas, 'bm-1');
      await flushMicrotasks();

      expect(obj.isBeingDragged).toBe(false);
      expect(obj.animate).not.toHaveBeenCalled();
      expect(obj.set).not.toHaveBeenCalled();
    });

    it('does NOT suppress a drag echo for a different battleMapId, player, or action', async () => {
      const obj = { id: 'obj-1', isBeingDragged: true, set: vi.fn(), animate: vi.fn() };
      const canvas = { getObjects: () => [obj], requestRenderAll: vi.fn(), renderAll: vi.fn() };
      convertFromDTOMock.mockReturnValue({ left: 5, top: 5 });
      const response = { data: { id: 'obj-1' }, battleMapId: 'bm-1', playerId: 'someone-else', action: 'drag' };

      await new OnUpdateElementBehavior().Handle(response, canvas, 'bm-1');
      await flushMicrotasks();

      expect(obj.animate).toHaveBeenCalled();
    });

    it('does NOT suppress when isBeingDragged was never set (a genuinely remote drag)', async () => {
      const obj = { id: 'obj-1', set: vi.fn(), animate: vi.fn() }; // isBeingDragged undefined
      const canvas = { getObjects: () => [obj], requestRenderAll: vi.fn(), renderAll: vi.fn() };
      convertFromDTOMock.mockReturnValue({ left: 5, top: 5 });
      const response = { data: { id: 'obj-1' }, battleMapId: 'bm-1', playerId: 'player-1', action: 'drag' };

      await new OnUpdateElementBehavior().Handle(response, canvas, 'bm-1');
      await flushMicrotasks();

      expect(obj.animate).toHaveBeenCalled();
    });
  });

  // Regression coverage (H3 — insideLayerIndex round-trip): the "layer" case used
  // to apply obj.layer from a remote update but never obj.insideLayerIndex, so a
  // remote bring-forward/send-backward never synced.
  describe('"layer" action', () => {
    it('applies both layer and insideLayerIndex from the update', async () => {
      const obj = { id: 'obj-1', layer: 50, selectablePermission: true };
      obj.set = vi.fn((key, val) => { obj[key] = val; });
      const canvas = { getObjects: () => [obj], requestRenderAll: vi.fn(), renderAll: vi.fn(), _objects: [obj] };
      convertFromDTOMock.mockReturnValue({ layer: 300, insideLayerIndex: 5 });
      clientMediatorMock.sendCommand.mockReturnValue(300); // GetSelectedLayer
      const response = { data: { id: 'obj-1', layer: 300, insideLayerIndex: 5 }, action: 'layer' };

      await new OnUpdateElementBehavior().Handle(response, canvas, 'bm-1');
      await flushMicrotasks();

      expect(obj.layer).toBe(300);
      expect(obj.insideLayerIndex).toBe(5);
    });
  });
});
