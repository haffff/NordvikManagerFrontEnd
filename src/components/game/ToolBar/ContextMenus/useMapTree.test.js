import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

let subscribers;
const get = vi.fn();
vi.mock('../../../../helpers/transport', () => ({
  ActiveWebHelper: { get: (...a) => get(...a) },
  ActiveTransportManager: {
    Subscribe: (key, cb) => { subscribers[key] = cb; },
    Unsubscribe: (key) => { delete subscribers[key]; },
  },
}));

import { useMapTree, mapMenuNodes } from './useMapTree';

const folder = (id, name, extra = {}) => ({ id, name, isFolder: true, ...extra });
const leaf = (id, targetId, extra = {}) => ({ id, targetId, isFolder: false, ...extra });
const fire = (event) => act(() => Object.values(subscribers).forEach((cb) => cb(event)));

describe('mapMenuNodes', () => {
  const maps = [{ id: 'm1', name: 'Forest' }, { id: 'm2', name: 'Cave' }, { id: 'm3', name: 'Town' }];

  it('puts maps in their folders, in tree order', () => {
    const entries = [
      folder('f1', 'Dungeons', { head: true, next: 'e3' }),
      leaf('e2', 'm2', { parentId: 'f1', head: true }),
      leaf('e3', 'm1'),
      leaf('e4', 'm3'),
    ];
    const nodes = mapMenuNodes(entries, maps);
    expect(nodes.map((n) => n.name)).toEqual(['Dungeons', 'Forest', 'Town']);
    expect(nodes[0].children.map((n) => n.entity.id)).toEqual(['m2']);
  });

  it('leaves out folders with no maps in them, however deep', () => {
    const entries = [
      folder('f1', 'Empty', { head: true, next: 'f2' }),
      folder('f2', 'Outer', { next: 'e1' }),
      folder('f3', 'Inner', { parentId: 'f2', head: true }),
      leaf('e1', 'm1'),
      leaf('e2', 'm2'),
      leaf('e3', 'm3'),
    ];
    expect(mapMenuNodes(entries, maps).map((n) => n.name)).toEqual(['Forest', 'Cave', 'Town']);
  });

  it('a map with no tree entry still shows, at the end', () => {
    const entries = [folder('f1', 'Dungeons', { head: true }), leaf('e1', 'm1', { parentId: 'f1', head: true })];
    const nodes = mapMenuNodes(entries, maps);
    expect(nodes.map((n) => n.name)).toEqual(['Dungeons', 'Cave', 'Town']);
  });

  it('no tree yet: the flat list', () => {
    expect(mapMenuNodes(null, maps).map((n) => n.name)).toEqual(['Forest', 'Cave', 'Town']);
  });
});

describe('useMapTree', () => {
  beforeEach(() => {
    subscribers = {};
    get.mockReset();
    get.mockImplementation((url, ok) => ok([leaf('e1', 'm1')]));
  });

  it('loads the MapModel tree', async () => {
    const { result } = renderHook(() => useMapTree());
    await waitFor(() => expect(result.current).toEqual([leaf('e1', 'm1')]));
    expect(get.mock.calls[0][0]).toBe('battlemap/getTree?entityType=MapModel');
  });

  it('reloads when a map entry moves', async () => {
    renderHook(() => useMapTree());
    fire({ command: 'tree_update', result: 'Ok', data: [{ id: 'e1', entryType: 'MapModel' }] });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('ignores other trees', async () => {
    renderHook(() => useMapTree());
    fire({ command: 'tree_update', result: 'Ok', data: [{ id: 'x', entryType: 'CardModel' }] });
    fire({ command: 'tree_add', result: 'Ok', data: { id: 'y', entryType: 'Playlist' } });
    fire({ command: 'card_update', result: 'Ok', data: { id: 'z' } });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('drops a removed entry', async () => {
    const { result } = renderHook(() => useMapTree());
    await waitFor(() => expect(result.current).toHaveLength(1));
    fire({ command: 'tree_remove', result: 'Ok', data: 'e1' });
    expect(result.current).toEqual([]);
  });

  it('stops listening when unmounted', () => {
    const { unmount } = renderHook(() => useMapTree());
    unmount();
    expect(Object.keys(subscribers)).toHaveLength(0);
  });
});
