import { vi, describe, it, expect } from 'vitest';
import { fabric } from 'fabric';

vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: { getMaterialAsync: vi.fn(), getResourceString: vi.fn((id, key) => `resource:${id ?? key}`) },
  ActiveTransportManager: { Send: vi.fn() },
}));
vi.mock('../../../ClientMediator', () => ({ default: { sendCommand: vi.fn(), sendCommandAsync: vi.fn() } }));

import TokenManager from './TokenManager';

// A token keeps its size on the map when its image is swapped: setSrc resets the
// image's width/height to the new picture's own, so the scale has to follow.

const GRID = 50;
const imageDep = { dtoProperty: 'tokenImage', objectProperty: 'src', type: 'string', source: 'element' };

// jsdom loads no images: setSrc is stood in for by what Fabric does once the new
// picture has loaded (new width/height, then the callback).
const tokenImage = (naturalSize) => {
  const t = new fabric.Image(document.createElement('img'), { width: naturalSize, height: naturalSize, strokeWidth: 0 });
  t.id = 'tok-1';
  t.scaleToWidth(GRID);
  t.setSrc = vi.fn(function (url, cb) {
    this.set({ width: 400, height: 300 });
    cb(this);
  });
  return t;
};

const manager = () => {
  const tm = new TokenManager();
  tm._getCanvas = () => ({ requestRenderAll: vi.fn() });
  tm._getSelectedMap = () => ({ id: 'map-1', gridSize: GRID });
  return tm;
};

describe('TokenManager: a new token image', () => {
  it('keeps the token as wide as it was on the map', () => {
    const t = tokenImage(1000); // the placeholder, scaled down to one square

    manager()._applyDep(imageDep, t, t, [{ name: 'tokenImage', value: 'new-image', entityName: 'Element' }]);

    expect(t.setSrc).toHaveBeenCalled();
    expect(t.getScaledWidth()).toBeCloseTo(GRID);
  });

  it('sizes a circle crop for the new picture', () => {
    const t = tokenImage(1000);
    t.clipPath = new fabric.Circle({ radius: 500, originX: 'center', originY: 'center' });

    manager()._applyDep(imageDep, t, t, [{ name: 'tokenImage', value: 'new-image', entityName: 'Element' }]);

    expect(t.clipPath.radius).toBe(150);
  });
});
