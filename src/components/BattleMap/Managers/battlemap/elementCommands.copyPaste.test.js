import { vi, describe, it, expect, beforeEach } from 'vitest';
import { fabric } from 'fabric';

const sent = vi.hoisted(() => []);
const props = vi.hoisted(() => ({ byId: {} }));

vi.mock('../../../../helpers/transport', () => ({
  ActiveWebHelper: {
    getAsync: vi.fn(async (path) => {
      const id = /parentIds=([^&]+)/.exec(path)?.[1];
      return props.byId[decodeURIComponent(id)] ?? [];
    }),
    getResourceString: vi.fn((id, key) => `resource:${id ?? key}`),
  },
  ActiveTransportManager: { Send: vi.fn((cmd) => sent.push(cmd)) },
}));
vi.mock('../../../ui/toaster', () => ({ toaster: { create: vi.fn() } }));

import { elementCommands } from './elementCommands';

// Copy and paste on the map: the pasted element is a whole copy of the original. A token is a
// group (its picture and its bars) with fields of its own, and its properties (a Basics token's
// bars, a card's values) live on the server: pasting used to lose the picture and the properties.

function service(selected) {
  const canvas = { discardActiveObject: vi.fn(), setActiveObject: vi.fn(), requestRenderAll: vi.fn() };
  return {
    ...elementCommands.methods,
    _canvas: canvas,
    _BMQueryService: {
      GetSelectedObjects: () => selected,
      GetSelectedLayer: () => 'tokens',
      GetSelectedMapID: () => 'map-1',
    },
  };
}

function token() {
  const picture = new fabric.Image(document.createElement('img'), { left: 0, top: 0, width: 50, height: 50 });
  picture.resourceId = 'res-1';
  const bar = new fabric.Rect({ left: 0, top: 55, width: 50, height: 6 });
  const group = new fabric.Group([picture, bar], { left: 100, top: 200 });
  group.id = 'el-1';
  group.layer = 'tokens';
  group.isToken = true;
  group.tokenData = '{"bars":["hp"]}';
  return group;
}

const pastedObject = (cmd) => JSON.parse(cmd.data.object);

describe('copy and paste on the map', () => {
  beforeEach(() => {
    sent.length = 0;
    props.byId = {
      'el-1': [
        { id: 'p1', parentID: 'el-1', name: 'hp', value: '7', entityName: 'ElementModel', permission: 3, isProtected: false },
        { id: 'p2', parentID: 'el-1', name: 'isToken', value: 'true', entityName: 'ElementModel' },
      ],
    };
  });

  it("keeps the token's picture and its own fields (the group's parts included)", async () => {
    const bm = service([token()]);
    bm.CopyElements();
    await bm.PasteElements({});

    expect(sent).toHaveLength(1);
    expect(sent[0].command).toBe('element_add');
    const object = pastedObject(sent[0]);
    expect(object.type).toBe('group');
    expect(object.isToken).toBe(true);
    expect(object.tokenData).toBe('{"bars":["hp"]}');
    expect(object.objects.map((o) => o.type)).toEqual(['image', 'rect']);
    expect(object.objects[0].resourceId).toBe('res-1');
  });

  it('copies its properties, as new ones', async () => {
    const bm = service([token()]);
    bm.CopyElements();
    await bm.PasteElements({});

    expect(sent[0].data.properties).toEqual([
      { name: 'hp', value: '7', permission: 3, isProtected: false },
      { name: 'isToken', value: 'true' },
    ]);
  });

  it('pastes a new element next to the original, each paste further on, on the selected layer and map', async () => {
    const bm = service([token()]);
    bm.CopyElements();
    await bm.PasteElements({});
    await bm.PasteElements({});

    const [first, second] = sent.map(pastedObject);
    expect(first.id).toBeUndefined();
    expect(first.left).toBe(110);
    expect(second.left).toBe(120);
    expect(sent[0].data).toMatchObject({ layer: 'tokens', mapId: 'map-1' });
  });

  it('pastes where it is told to', async () => {
    const bm = service([token()]);
    bm.CopyElements();
    await bm.PasteElements({ coords: { x: 400, y: 300 } });

    expect(pastedObject(sent[0])).toMatchObject({ left: 400, top: 300 });
  });

  it('a later change to the original does not change what was copied', async () => {
    const original = token();
    const bm = service([original]);
    bm.CopyElements();
    original.set({ left: 900 });
    original.tokenData = 'changed';
    await bm.PasteElements({});

    expect(pastedObject(sent[0])).toMatchObject({ left: 110, tokenData: '{"bars":["hp"]}' });
  });
});
