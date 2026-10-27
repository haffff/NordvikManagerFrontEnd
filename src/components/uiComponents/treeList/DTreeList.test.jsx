import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, createEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../setupTests';

// Selecting several entries (Ctrl/⌘, Shift) and moving them together by dragging one.

vi.mock('../base/Subscribable', () => ({ default: () => null }));
vi.mock('../base/Modals/InputModal', () => ({ default: () => null }));
vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: { get: vi.fn() },
  ActiveTransportManager: { Send: vi.fn() },
}));

import { ActiveWebHelper as WebHelper, ActiveTransportManager } from '../../../helpers/transport';
import { DTreeList } from './DTreeList';

// Root: Maps(folder) → Goblin → Orc ; Maps: Dungeon
const tree = [
  { id: 'maps', isFolder: true, name: 'Maps', head: true, next: 'e-goblin', entryType: 'Card' },
  { id: 'e-goblin', targetId: 'goblin', next: 'e-orc', entryType: 'Card' },
  { id: 'e-orc', targetId: 'orc', entryType: 'Card' },
  { id: 'e-dungeon', targetId: 'dungeon', head: true, parentId: 'maps', entryType: 'Card' },
];
const items = [{ id: 'goblin', name: 'Goblin' }, { id: 'orc', name: 'Orc' }, { id: 'dungeon', name: 'Dungeon' }];

const makeDataTransfer = () => {
  const data = {};
  return { setData: (t, v) => { data[t] = v; }, getData: (t) => data[t] ?? '', get types() { return Object.keys(data); }, effectAllowed: 'all', dropEffect: 'move' };
};
const drop = (el, dataTransfer, clientY) => {
  const evt = createEvent.drop(el, { dataTransfer });
  Object.defineProperty(evt, 'clientY', { value: clientY });
  fireEvent(el, evt);
};
const row = (id) => screen.getAllByRole('treeitem').find((r) => r.getAttribute('data-row-id') === id);
const selectedRows = () => screen.getAllByRole('treeitem').filter((r) => r.getAttribute('aria-selected') === 'true').map((r) => r.getAttribute('data-row-id'));
const updates = () => ActiveTransportManager.Send.mock.calls.map(([m]) => m).filter((m) => m.command === 'tree_update').map((m) => m.data);

describe('DTreeList with several entries selected', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    WebHelper.get.mockImplementation((url, ok) => ok(tree));
  });
  afterEach(() => vi.restoreAllMocks());

  it('drags them all into a folder, in tree order', async () => {
    const onSelect = vi.fn();
    renderWithProviders(<div style={{ height: 600 }}><DTreeList entityType="Card" items={items} canEditFolders onSelect={onSelect} /></div>);
    await screen.findByText('Orc');

    fireEvent.click(row('e-orc'));
    fireEvent.click(row('e-goblin'), { ctrlKey: true });
    expect(selectedRows()).toEqual(['e-goblin', 'e-orc']);
    expect(onSelect).toHaveBeenCalledTimes(1);

    const dt = makeDataTransfer();
    fireEvent.dragStart(row('e-orc').querySelector('[data-drag-handle]'), { dataTransfer: dt });
    vi.spyOn(row('maps'), 'getBoundingClientRect').mockReturnValue({ top: 0, height: 28, bottom: 28, left: 0, right: 200, width: 200, x: 0, y: 0, toJSON() {} });
    drop(row('maps'), dt, 14);

    expect(updates()).toEqual([
      { id: 'e-goblin', parentId: 'maps', next: null },
      { id: 'e-orc', parentId: 'maps', next: null },
    ]);
  });

  it('drags just the one row when it is not part of the selection', async () => {
    renderWithProviders(<div style={{ height: 600 }}><DTreeList entityType="Card" items={items} canEditFolders /></div>);
    await screen.findByText('Orc');

    fireEvent.click(row('e-orc'));
    fireEvent.click(row('e-goblin'), { ctrlKey: true });
    const dt = makeDataTransfer();
    fireEvent.dragStart(row('maps').querySelector('[data-drag-handle]'), { dataTransfer: dt });
    vi.spyOn(row('e-orc'), 'getBoundingClientRect').mockReturnValue({ top: 56, height: 28, bottom: 84, left: 0, right: 200, width: 200, x: 0, y: 56, toJSON() {} });
    drop(row('e-orc'), dt, 80);

    expect(updates()).toEqual([{ id: 'maps', parentId: null, next: null }]);
  });
});
