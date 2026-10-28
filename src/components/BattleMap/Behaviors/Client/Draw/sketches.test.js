import { vi, describe, it, expect, beforeEach } from 'vitest';

const sendMock = vi.fn();
vi.mock('../../../../../helpers/transport', () => ({
  ActiveTransportManager: { Send: (...args) => sendMock(...args) },
}));

vi.mock('../../../../../ClientMediator', () => ({
  default: {
    sendCommand: (panel, command) => (command === 'GetCurrentPlayer' ? { id: 'me' } : undefined),
  },
}));

vi.mock('../../../DTOConverter', () => ({ default: { ConvertToDTO: (o) => ({ dto: o.id }) } }));

import { OnPathCreatedFreeDrawClientBehavior } from './OnPathCreatedFreeDraw';
import { cleanSketches, undoSketch } from './sketches';

function fakeObject(props) {
  return { ...props, set(values) { Object.assign(this, values); return this; } };
}

function makeCanvas(objects = []) {
  return {
    objects,
    getObjects() { return this.objects; },
    add(o) { this.objects.push(o); },
    remove(...os) { this.objects = this.objects.filter((x) => !os.includes(x)); },
    requestRenderAll() {},
  };
}

const draw = (canvas, path) =>
  new OnPathCreatedFreeDrawClientBehavior().Handle({ path }, canvas, { id: 'map-1' }, 'bm-1');

describe('sketch mode — drawings are previews, not map elements', () => {
  beforeEach(() => sendMock.mockClear());

  it('keeps the stroke on the canvas and shows it to others as a preview', () => {
    const canvas = makeCanvas();
    canvas.freeDrawMode = true;
    canvas.freeDrawSketch = { visibleToOthers: true };
    const path = fakeObject({ type: 'path' });
    canvas.add(path);

    draw(canvas, path);

    expect(canvas.objects).toContain(path);
    expect(path).toMatchObject({ sketch: true, playerId: 'me', selectable: false, evented: false });
    expect(path.previewId).toBeTruthy();
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith({ command: 'preview_start', battleMapId: 'bm-1', data: [path] });
  });

  it('sends nothing when not visible to others', () => {
    const canvas = makeCanvas();
    canvas.freeDrawMode = true;
    canvas.freeDrawSketch = { visibleToOthers: false };
    const path = fakeObject({ type: 'path' });
    canvas.add(path);

    draw(canvas, path);

    expect(canvas.objects).toContain(path);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('ordinary draw mode still adds a map element', () => {
    const canvas = makeCanvas();
    canvas.freeDrawMode = true;
    canvas.selectedLayer = 2;
    const path = fakeObject({ id: 'p', type: 'path' });
    canvas.add(path);

    draw(canvas, path);

    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ command: 'element_add' }));
    expect(canvas.objects).not.toContain(path);
  });
});

describe('undo / clean sketches', () => {
  beforeEach(() => sendMock.mockClear());

  function sketched(canvas, n) {
    canvas.freeDrawMode = true;
    canvas.freeDrawSketch = { visibleToOthers: true };
    const paths = [];
    for (let i = 0; i < n; i++) {
      const path = fakeObject({ type: 'path' });
      canvas.add(path);
      draw(canvas, path);
      paths.push(path);
    }
    sendMock.mockClear();
    return paths;
  }

  it('undo removes only my last stroke, here and for others', () => {
    const canvas = makeCanvas();
    const [first, second] = sketched(canvas, 2);

    undoSketch(canvas, 'bm-1');

    expect(canvas.objects).toEqual([first]);
    expect(sendMock).toHaveBeenCalledWith({
      command: 'preview_end', battleMapId: 'bm-1', data: [{ previewId: second.previewId, playerId: 'me' }],
    });
  });

  it('undo skips strokes that were already cleared', () => {
    const canvas = makeCanvas();
    const [first, second] = sketched(canvas, 2);
    canvas.remove(second);

    undoSketch(canvas, 'bm-1');

    expect(canvas.objects).toEqual([]);
    expect(sendMock.mock.calls[0][0].data).toEqual([{ previewId: first.previewId, playerId: 'me' }]);
  });

  it('clean removes all my sketches but not my measurements or others\' sketches', () => {
    const measurement = fakeObject({ previewId: 'm1', playerId: 'me' });
    const theirs = fakeObject({ previewId: 'o1', playerId: 'other', preview: true });
    const canvas = makeCanvas([measurement, theirs]);
    sketched(canvas, 2);

    cleanSketches(canvas, 'bm-1');

    expect(canvas.objects).toEqual([measurement, theirs]);
    expect(sendMock.mock.calls[0][0].data).toHaveLength(2);
  });

  it('clearing everyone\'s removes every preview on the map', () => {
    const theirs = fakeObject({ previewId: 'o1', playerId: 'other', preview: true });
    const canvas = makeCanvas([theirs]);
    const [mine] = sketched(canvas, 1);

    cleanSketches(canvas, 'bm-1', { everyone: true });

    expect(canvas.objects).toEqual([]);
    expect(sendMock.mock.calls[0][0].data).toEqual([
      { previewId: 'o1', playerId: 'other' },
      { previewId: mine.previewId, playerId: 'me' },
    ]);
  });
});
