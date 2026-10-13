import { vi, describe, it, expect } from 'vitest';

vi.mock('../../../../../ClientMediator', () => ({
  default: {
    sendCommandAsync: async (panel, command) => (command === 'GetCurrentPlayer' ? { id: 'me' } : undefined),
    sendCommand: (panel, command) => (command === 'GetOwner' ? 'gm' : undefined),
  },
}));

import { OnPreviewEndBehavior } from './OnPreviewEnd';

function makeCanvas(objects) {
  return {
    objects,
    getObjects() { return this.objects; },
    remove(...os) { this.objects = this.objects.filter((x) => !os.includes(x)); },
    requestRenderAll() {},
  };
}

const end = (canvas, playerId, data) =>
  new OnPreviewEndBehavior().Handle({ battleMapId: 'bm-1', playerId, data }, canvas, 'bm-1');

describe('preview_end removes the listed previews', () => {
  it('removes only the listed previews of the sender, not their others', async () => {
    const a = { previewId: 'a', playerId: 'p1', preview: true };
    const b = { previewId: 'b', playerId: 'p1', preview: true };
    const canvas = makeCanvas([a, b]);

    await end(canvas, 'p1', [{ previewId: 'a', playerId: 'p1' }]);

    expect(canvas.objects).toEqual([b]);
  });

  it('a player cannot remove someone else\'s preview', async () => {
    const theirs = { previewId: 'x', playerId: 'p2', preview: true };
    const canvas = makeCanvas([theirs]);

    await end(canvas, 'p1', [{ previewId: 'x', playerId: 'p2' }]);

    expect(canvas.objects).toEqual([theirs]);
  });

  it('the GM can clear anyone\'s, including this player\'s own sketches', async () => {
    const mine = { previewId: 'm', playerId: 'me', sketch: true };
    const theirs = { previewId: 'x', playerId: 'p2', preview: true };
    const canvas = makeCanvas([mine, theirs]);

    await end(canvas, 'gm', [{ previewId: 'm', playerId: 'me' }, { previewId: 'x', playerId: 'p2' }]);

    expect(canvas.objects).toEqual([]);
  });

  it('without ids it still removes all of the sender\'s previews', async () => {
    const a = { previewId: 'a', playerId: 'p1', preview: true };
    const other = { previewId: 'o', playerId: 'p2', preview: true };
    const canvas = makeCanvas([a, other]);

    await end(canvas, 'p1', []);

    expect(canvas.objects).toEqual([other]);
  });
});
