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
  const p = (previewId, playerId, kind = 'preview') => ({ previewId, playerId, [kind]: true });

  // objects: what is on the canvas; remaining: the keys of those still there afterwards.
  it.each([
    {
      name: 'removes only the listed previews of the sender, not their others',
      objects: { a: p('a', 'p1'), b: p('b', 'p1') }, sender: 'p1',
      data: [{ previewId: 'a', playerId: 'p1' }], remaining: ['b'],
    },
    {
      name: 'a player cannot remove someone else\'s preview',
      objects: { theirs: p('x', 'p2') }, sender: 'p1',
      data: [{ previewId: 'x', playerId: 'p2' }], remaining: ['theirs'],
    },
    {
      name: 'the GM can clear anyone\'s, including this player\'s own sketches',
      objects: { mine: p('m', 'me', 'sketch'), theirs: p('x', 'p2') }, sender: 'gm',
      data: [{ previewId: 'm', playerId: 'me' }, { previewId: 'x', playerId: 'p2' }], remaining: [],
    },
    {
      name: 'without ids it still removes all of the sender\'s previews',
      objects: { a: p('a', 'p1'), other: p('o', 'p2') }, sender: 'p1',
      data: [], remaining: ['other'],
    },
  ])('$name', async ({ objects, sender, data, remaining }) => {
    const canvas = makeCanvas(Object.values(objects));

    await end(canvas, sender, data);

    expect(canvas.objects).toEqual(remaining.map((key) => objects[key]));
  });
});
