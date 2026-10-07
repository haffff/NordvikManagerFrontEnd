import { vi, describe, it, expect } from 'vitest';

vi.mock('../../../helpers/transport', () => ({
  ActiveTransportManager: { Send: vi.fn() },
}));
vi.mock('../../../ClientMediator', () => ({
  default: { sendCommand: vi.fn(), sendCommandAsync: vi.fn() },
}));
vi.mock('../../ui/toaster', () => ({ toaster: { create: vi.fn() } }));

import BMService from './BMService';
import { ActiveTransportManager as WebSocketManagerInstance } from '../../../helpers/transport';
import ClientMediator from '../../../ClientMediator';

// A fake fabric object supporting both .set(patchObject) and .set(key, value),
// mirroring fabric.Object's real dual-signature API.
function makeFakeObject(props) {
  const obj = { ...props };
  obj.set = vi.fn((keyOrPatch, value) => {
    if (typeof keyOrPatch === 'string') {
      obj[keyOrPatch] = value;
    } else {
      Object.assign(obj, keyOrPatch);
    }
  });
  return obj;
}

// Regression coverage for SetLayerEditMode's opacity truthiness bug.
describe('BMService.SetLayerEditMode', () => {
  it('restores an object whose original opacity was exactly 0 when edit mode turns off', () => {
    // The old code checked `if (object.origOpacity)` — falsy for 0 — so an
    // object that started fully transparent never got its opacity restored and
    // stayed dimmed/wrong forever once edit mode toggled off.
    const service = new BMService();
    const obj = makeFakeObject({ layer: 999, origOpacity: 0, opacity: -0.2 });
    const canvas = {
      editMode: 'edit', // anything truthy and != false, so the off-toggle isn't a no-op
      editLayer: 999,
      discardActiveObject: vi.fn(),
      getObjects: () => [obj],
      requestRenderAll: vi.fn(),
    };
    service._canvas = canvas;

    service.SetLayerEditMode({ editMode: false, layer: 999 });

    expect(obj.opacity).toBe(0);
    expect(obj.origOpacity).toBeUndefined();
  });

  it('restores an object whose original opacity was exactly 0 when its own layer becomes the active edit layer', () => {
    const service = new BMService();
    const obj = makeFakeObject({ layer: 5, origOpacity: 0, opacity: -0.2, currentlyEdited: undefined });
    const canvas = {
      editMode: undefined,
      editLayer: undefined,
      discardActiveObject: vi.fn(),
      getObjects: () => [obj],
      requestRenderAll: vi.fn(),
    };
    service._canvas = canvas;

    service.SetLayerEditMode({ editMode: true, layer: 5 });

    expect(obj.opacity).toBe(0);
    expect(obj.origOpacity).toBeUndefined();
  });

  it('clamps the dim step so a low-opacity object never goes negative', () => {
    const service = new BMService();
    const obj = makeFakeObject({ layer: 5, opacity: 0.3 }); // on a different layer than the one being edited
    const canvas = {
      editMode: undefined,
      editLayer: undefined,
      discardActiveObject: vi.fn(),
      getObjects: () => [obj],
      requestRenderAll: vi.fn(),
    };
    service._canvas = canvas;

    service.SetLayerEditMode({ editMode: true, layer: 999 });

    expect(obj.opacity).toBe(0); // 0.3 - 0.5 clamped to 0, not -0.2
    expect(obj.origOpacity).toBe(0.3);
  });
});

// Regression coverage for CleanPreviews sending a doubly-nested `data` array —
// this is the only preview_end sent for "stay visible" previews, so the shape
// mismatch could leave stale ruler/cone/circle previews on other clients.
describe('BMService.CleanPreviews', () => {
  it('sends a flat array of {previewId, playerId}, not a nested array', () => {
    const service = new BMService();
    const previewObj = { previewId: 'p1', playerId: 'player-1' };
    const canvas = {
      getObjects: () => [previewObj],
      remove: vi.fn(),
      requestRenderAll: vi.fn(),
      measure: { visibleToOthers: true },
    };
    service._canvas = canvas;
    service.contextId = 'bm-1';

    ClientMediator.sendCommand.mockReturnValue({ id: 'player-1' }); // GetCurrentPlayer

    service.CleanPreviews();

    expect(WebSocketManagerInstance.Send).toHaveBeenCalledWith({
      command: 'preview_end',
      battleMapId: 'bm-1',
      data: [{ previewId: 'p1', playerId: 'player-1' }],
    });
  });
});

describe('BMService.FocusElement', () => {
  const canvasWith = (objects) => ({
    getObjects: () => objects,
    getZoom: () => 2,
    getWidth: () => 800,
    getHeight: () => 600,
    viewportTransform: [2, 0, 0, 2, 0, 0],
    setViewportTransform: vi.fn(function (vpt) { this.viewportTransform = vpt; }),
    setActiveObject: vi.fn(),
    requestRenderAll: vi.fn(),
  });

  it("centres the view on the element and selects it when it's selectable", () => {
    const service = new BMService();
    const token = { id: 't1', selectable: true, getCenterPoint: () => ({ x: 100, y: 50 }) };
    service._canvas = canvasWith([token]);

    service.FocusElement({ elementId: 't1' });

    // screen centre (400, 300) = element centre (100, 50) * zoom 2 + pan
    expect(service._canvas.setViewportTransform).toHaveBeenCalledWith([2, 0, 0, 2, 200, 200]);
    expect(service._canvas.setActiveObject).toHaveBeenCalledWith(token);
  });

  it("only centres on an element the player can't select", () => {
    const service = new BMService();
    service._canvas = canvasWith([{ id: 't1', selectable: false, getCenterPoint: () => ({ x: 0, y: 0 }) }]);

    service.FocusElement({ elementId: 't1' });

    expect(service._canvas.setViewportTransform).toHaveBeenCalled();
    expect(service._canvas.setActiveObject).not.toHaveBeenCalled();
  });

  it('reports an element that is not on this map', () => {
    const service = new BMService();
    service._canvas = canvasWith([]);

    expect(service.FocusElement({ elementId: 'nope' })).toMatch(/not on this map/);
  });
});
