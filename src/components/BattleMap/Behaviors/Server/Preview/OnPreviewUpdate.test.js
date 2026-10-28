import { vi, describe, it, expect } from 'vitest';

vi.mock('../../../../../ClientMediator', () => ({
  default: {
    sendCommandAsync: async (panel, command) => (command === 'GetCurrentPlayer' ? { id: 'me' } : undefined),
    sendCommand: (panel, command) => (command === 'GetOwner' ? 'gm' : undefined),
  },
}));

import { OnPreviewUpdateBehavior } from './OnPreviewUpdate';
import { OnPreviewEndBehavior } from './OnPreviewEnd';

// Someone measuring an area or aiming one (RequestPoint) with "Highlight tokens": the tokens
// it covers glow on everyone's map, not only theirs.
const token = (id, x) => ({
  id, tokenData: {}, shadow: 'own',
  getCenterPoint: () => ({ x, y: 0 }), getScaledWidth: () => 50, getScaledHeight: () => 50,
  set(props) { Object.assign(this, props); },
});

const areaPreview = () => ({
  previewId: 'area', playerId: 'p1', preview: true,
  set(props) { Object.assign(this, props); },
  setCoords() {},
});

function makeCanvas(objects) {
  return {
    objects,
    getObjects() { return this.objects; },
    remove(...os) { this.objects = this.objects.filter((x) => !os.includes(x)); },
    requestRenderAll() {},
  };
}

const circle = { shape: 'circle', x: 0, y: 0, radius: 100 };

const update = (canvas, data, playerId = 'p1') =>
  new OnPreviewUpdateBehavior().Handle({ battleMapId: 'bm-1', playerId, data }, canvas, 'bm-1');

describe('preview_update with a glow', () => {
  it('lights up the tokens the area covers', async () => {
    const near = token('near', 120), far = token('far', 400);
    const canvas = makeCanvas([areaPreview(), near, far]);

    await update(canvas, [{ previewId: 'area', left: 5, glow: { area: circle, color: 'rgba(1,2,3,0.9)' } }]);

    expect(near.shadow.color).toBe('rgba(1,2,3,0.9)');
    expect(far.shadow).toBe('own');
  });

  it('puts them back when the area stops covering them', async () => {
    const near = token('near', 120);
    const canvas = makeCanvas([areaPreview(), near]);

    await update(canvas, [{ previewId: 'area', glow: { area: circle, color: 'red' } }]);
    await update(canvas, [{ previewId: 'area', glow: null }]);

    expect(near.shadow).toBe('own');
  });

  it('leaves out the token the area starts from', async () => {
    const caster = token('caster', 0);
    const canvas = makeCanvas([areaPreview(), caster]);

    await update(canvas, [{ previewId: 'area', glow: { area: circle, color: 'red', exceptId: 'caster' } }]);

    expect(caster.shadow).toBe('own');
  });

  it('only moves the preview itself: the glow is not set on it', async () => {
    const preview = areaPreview();
    const canvas = makeCanvas([preview]);

    await update(canvas, [{ previewId: 'area', left: 5, glow: { area: circle, color: 'red' } }]);

    expect(preview.left).toBe(5);
    expect(preview.glow).toBeUndefined();
  });

  it('an update without a glow leaves the tokens as they are', async () => {
    const near = token('near', 120);
    const canvas = makeCanvas([areaPreview(), near]);

    await update(canvas, [{ previewId: 'area', glow: { area: circle, color: 'red' } }]);
    await update(canvas, [{ previewId: 'area', left: 7 }]);

    expect(near.shadow.color).toBe('red');
  });

  it('ignores this player\'s own updates', async () => {
    const near = token('near', 120);
    const canvas = makeCanvas([areaPreview(), near]);

    await update(canvas, [{ previewId: 'area', glow: { area: circle, color: 'red' } }], 'me');

    expect(near.shadow).toBe('own');
  });

  it('the glow goes when the sender\'s preview ends', async () => {
    const near = token('near', 120);
    const canvas = makeCanvas([areaPreview(), near]);
    await update(canvas, [{ previewId: 'area', glow: { area: circle, color: 'red' } }]);

    await new OnPreviewEndBehavior().Handle({ battleMapId: 'bm-1', playerId: 'p1', data: [{ previewId: 'area' }] }, canvas, 'bm-1');

    expect(near.shadow).toBe('own');
  });
});
