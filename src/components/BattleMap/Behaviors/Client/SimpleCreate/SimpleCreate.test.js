import { vi, describe, it, expect, beforeEach } from 'vitest';

const sendMock = vi.fn();
vi.mock('../../../../../helpers/transport', () => ({
  ActiveTransportManager: { Send: (...args) => sendMock(...args) },
}));

vi.mock('../../../DTOConverter', () => ({
  default: { ConvertToDTO: (object) => ({ ...object }) },
}));

// enlivenObjects hands back a plain object that records set() calls, standing in
// for the fabric object made from the create element.
vi.mock('fabric', () => ({
  fabric: {
    util: {
      enlivenObjects: (elements, callback) => callback(elements.map((e) => fakeObject({ ...e }))),
    },
  },
}));

function fakeObject(props) {
  return { ...props, set(values) { Object.assign(this, values); return this; } };
}

import { OnMouseDownSimpleCreateClientBehavior } from './OnMouseDownSimpleCreate';
import { OnMouseMoveSimpleCreateClientBehavior } from './OnMouseMoveSimpleCreate';
import { OnMouseUpSimpleCreateClientBehavior } from './OnMouseUpSimpleCreate';

const down = new OnMouseDownSimpleCreateClientBehavior();
const move = new OnMouseMoveSimpleCreateClientBehavior();
const up = new OnMouseUpSimpleCreateClientBehavior();

function makeCanvas(withSizing, element) {
  const canvas = {
    simpleCreateMode: true,
    simpleCreateElement: element,
    withSizing,
    objects: [],
    pointer: { x: 0, y: 0 },
    getPointerWithAlign() { return this.pointer; },
    add(o) { this.objects.push(o); },
    remove(o) { this.objects = this.objects.filter((x) => x !== o); },
    requestRenderAll() {},
  };
  return canvas;
}

// Press at `from`, drag to `to`, release; returns the element sent (or undefined).
function drag(canvas, from, to) {
  canvas.pointer = from;
  down.Handle({}, canvas, {}, 'bm-1');
  canvas.pointer = to;
  move.Handle({}, canvas, {}, 'bm-1');
  const preview = canvas.previewObject;
  up.Handle({}, canvas, {}, 'bm-1');
  return { preview, sent: sendMock.mock.calls.at(-1)?.[0]?.data };
}

describe('simple create — circle sized by dragging from its center', () => {
  beforeEach(() => sendMock.mockClear());

  it('grows the preview from the pressed point, radius = drag distance', () => {
    const canvas = makeCanvas('radius', { type: 'circle', radius: 100 });
    canvas.pointer = { x: 100, y: 100 };
    down.Handle({}, canvas, {}, 'bm-1');
    canvas.pointer = { x: 130, y: 140 };
    move.Handle({}, canvas, {}, 'bm-1');

    expect(canvas.previewObject).toMatchObject({ left: 100, top: 100, originX: 'center', originY: 'center', radius: 50 });
  });

  it('places the circle with a top-left origin around that center', () => {
    const canvas = makeCanvas('radius', { type: 'circle', radius: 100 });
    const { sent } = drag(canvas, { x: 100, y: 100 }, { x: 130, y: 140 });

    expect(sent).toMatchObject({ left: 50, top: 50, radius: 50, originX: 'left', originY: 'top' });
    expect(canvas.objects).toHaveLength(0);
  });

  it('discards a circle too small to have been meant', () => {
    const canvas = makeCanvas('radius', { type: 'circle', radius: 100 });
    drag(canvas, { x: 100, y: 100 }, { x: 102, y: 101 });

    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe('simple create — text sized by the drag height', () => {
  beforeEach(() => sendMock.mockClear());

  it('font size follows the dragged height', () => {
    const canvas = makeCanvas('fontSize', { type: 'i-text', text: 'Text', fontSize: 40, lineHeight: 1.16 });
    const { sent } = drag(canvas, { x: 10, y: 20 }, { x: 60, y: 78 });

    expect(sent).toMatchObject({ left: 10, top: 20, fontSize: 50 });
  });

  it('dragging upward puts the text at the top of the box', () => {
    const canvas = makeCanvas('fontSize', { type: 'i-text', text: 'Text', fontSize: 40, lineHeight: 1.16 });
    const { sent } = drag(canvas, { x: 10, y: 100 }, { x: 60, y: 42 });

    expect(sent).toMatchObject({ left: 10, top: 42, fontSize: 50 });
  });

  it('a click without dragging still places the text at its default size', () => {
    const canvas = makeCanvas('fontSize', { type: 'i-text', text: 'Text', fontSize: 40, lineHeight: 1.16 });
    const { sent } = drag(canvas, { x: 10, y: 20 }, { x: 11, y: 22 });

    expect(sent).toMatchObject({ left: 10, top: 20, fontSize: 40 });
  });
});

describe('simple create — rectangle box sizing is unchanged', () => {
  beforeEach(() => sendMock.mockClear());

  it.each(['box', true])('withSizing %s sizes a box from the anchor', (withSizing) => {
    const canvas = makeCanvas(withSizing, { type: 'rect', width: 21, height: 21 });
    const { sent } = drag(canvas, { x: 100, y: 100 }, { x: 40, y: 160 });

    expect(sent).toMatchObject({ left: 40, top: 100, width: 60, height: 60 });
  });

  it('discards a tiny box', () => {
    const canvas = makeCanvas('box', { type: 'rect', width: 21, height: 21 });
    drag(canvas, { x: 100, y: 100 }, { x: 105, y: 104 });

    expect(sendMock).not.toHaveBeenCalled();
  });
});
