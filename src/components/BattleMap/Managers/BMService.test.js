import { vi, describe, it, expect } from 'vitest';

vi.mock('../../../helpers/transport', () => ({
  ActiveTransportManager: { Send: vi.fn() },
  ActiveWebHelper: { getResourceString: (id, key) => `resource?${id ?? key}` },
}));
vi.mock('../../../ClientMediator', () => ({
  default: { sendCommand: vi.fn(), sendCommandAsync: vi.fn(), fireEvent: vi.fn() },
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

// Measuring makes everything unselectable; leaving it (the Tools panel's DisableAllModes)
// must give tokens back the selectability they had, or they can't be selected until the
// player picks a layer again.
describe('BMService measure mode', () => {
  const measuringService = (objects) => {
    const service = new BMService();
    service._canvas = {
      getObjects: () => objects,
      discardActiveObject: vi.fn(),
      requestRenderAll: vi.fn(),
      remove: vi.fn(),
    };
    service._addPopupAndOverlay = vi.fn();
    service._removePopupAndOverlay = vi.fn();
    service.SetDragMode = vi.fn();
    ClientMediator.sendCommand.mockReturnValue({ id: 'player-1' });
    ClientMediator.sendCommandAsync.mockImplementation(async (_panel, command) =>
      command === 'GetSelectedMap' ? { id: 'map-1' } : command === 'GetGameId' ? 'game-1' : []);
    return service;
  };

  it('gives objects their selectability back when measuring ends', async () => {
    const token = makeFakeObject({ id: 't1', selectable: true });
    const background = makeFakeObject({ id: 'bg', selectable: false });
    const service = measuringService([token, background]);

    await service.SetMeasureMode({ enabled: true, type: 'Circle', playerColor: 'red', measureObject: {} });
    expect(token.selectable).toBe(false);
    service.DisableAllModes();

    expect(token.selectable).toBe(true);
    expect(background.selectable).toBe(false);
    expect(token.beforeMeasureSelectable).toBeUndefined();
  });

  it('does not complain about modes that are not on', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const service = measuringService([]);
    service.SetLayerEditMode = vi.fn();

    service.DisableAllModes();

    expect(warn).not.toHaveBeenCalledWith('Cannot unset token select mode.');
    warn.mockRestore();
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

// ── Group / ungroup ───────────────────────────────────────────────────────────
import { fabric } from 'fabric';
import { toaster } from '../../ui/toaster';
import { ungroupedParts } from './BMService';
import DTOConverter from '../DTOConverter';

describe('BMService grouping', () => {
  const rect = (id, left, top) => Object.assign(new fabric.Rect({ left, top, width: 10, height: 10 }), { id, layer: 1 });
  const serviceWith = (selected) => {
    const service = new BMService();
    service._canvas = { discardActiveObject: vi.fn() };
    service._BMQueryService = { GetSelectedObjects: () => selected, GetSelectedMapID: () => 'map-1' };
    return service;
  };
  const sent = () => WebSocketManagerInstance.Send.mock.calls.map(([c]) => c);

  it('groups the selection as one element placed where its parts are', () => {
    WebSocketManagerInstance.Send.mockClear();
    serviceWith([rect('a', 0, 0), rect('b', 30, 20)]).GroupSelected();

    const [cmd] = sent();
    expect(cmd.command).toBe('element_group');
    expect(cmd.elementIds).toEqual(['a', 'b']);
    const group = JSON.parse(cmd.data.object);
    expect([group.left, group.top, group.width, group.height]).toEqual([0, 0, 41, 31]);
    // Each part by its centre, from the group's centre.
    expect(group.objects.map((o) => [o.left, o.top])).toEqual([[-15, -10], [15, 10]]);
  });

  it('leaves tokens out, and says so', () => {
    WebSocketManagerInstance.Send.mockClear();
    toaster.create.mockClear();
    const token = Object.assign(rect('t', 60, 0), { isToken: true });

    serviceWith([rect('a', 0, 0), token, rect('b', 30, 20)]).GroupSelected();

    expect(sent()[0].elementIds).toEqual(['a', 'b']);
    expect(toaster.create).toHaveBeenCalledWith(expect.objectContaining({ title: "Tokens can't be grouped" }));
  });

  it('groups nothing when only a token and one other thing are selected', () => {
    WebSocketManagerInstance.Send.mockClear();
    serviceWith([rect('a', 0, 0), Object.assign(rect('t', 60, 0), { isToken: true })]).GroupSelected();

    expect(sent()).toEqual([]);
  });

  it('puts the parts of a turned, scaled group back where they show', () => {
    const a = rect('a', 0, 0);
    const b = rect('b', 40, 0);
    const group = new fabric.Group([a, b], { angle: 90, scaleX: 2, scaleY: 2 });
    const shown = group.getObjects().map((o) => fabric.util.transformPoint(o.getCenterPoint(), group.calcTransformMatrix()));

    const parts = ungroupedParts(group);

    parts.forEach((part, i) => {
      expect(part.left).toBeCloseTo(shown[i].x, 5);
      expect(part.top).toBeCloseTo(shown[i].y, 5);
      expect(part.angle).toBeCloseTo(90, 5);
      expect(part.scaleX).toBeCloseTo(2, 5);
      expect(part.originX).toBe('center');
      expect(part.id).toBe(i === 0 ? 'a' : 'b');
    });
  });
});

describe('DTOConverter with a group', () => {
  it('gives pictures inside a group their src back', () => {
    const object = DTOConverter.ConvertFromDTO({
      id: 'g', layer: 1,
      object: JSON.stringify({ type: 'group', objects: [{ type: 'image', resourceId: 'r1' }, { type: 'rect' }] }),
    });

    expect(object.objects[0].src).toBeTruthy();
    expect(object.objects[1].src).toBeUndefined();
  });
});
