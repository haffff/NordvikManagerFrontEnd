import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, createEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../setupTests';

// Selecting several entries (Ctrl/⌘, Shift) and moving them together by dragging one.

vi.mock('../base/Subscribable', () => ({ default: () => null }));
vi.mock('../base/Modals/InputModal', () => ({ default: () => null }));
vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: { get: vi.fn() },
  ActiveTransportManager: { Send: vi.fn() },
}));
vi.mock('../../../helpers/entityTransfer', async (importOriginal) => ({
  ...(await importOriginal()),
  duplicateEntity: vi.fn(),
  exportEntity: vi.fn(),
  importEntity: vi.fn(),
  downloadJson: vi.fn(),
}));
vi.mock('../../ui/toaster', () => ({ toaster: { create: vi.fn() } }));

import { ActiveWebHelper as WebHelper, ActiveTransportManager } from '../../../helpers/transport';
import { duplicateEntity, exportEntity, importEntity, downloadJson } from '../../../helpers/entityTransfer';
import { toaster } from '../../ui/toaster';
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

describe('DTreeList Duplicate / Export JSON / Import JSON', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    WebHelper.get.mockImplementation((url, ok) => ok(tree));
    duplicateEntity.mockResolvedValue({ id: 'copy', missing: [] });
  });

  const renderTree = (props = {}) =>
    renderWithProviders(<div style={{ height: 600 }}><DTreeList entityType="Card" items={items} canEditFolders transferKind="card" {...props} /></div>);

  it('duplicates the selected item right after it', async () => {
    renderTree();
    await screen.findByText('Orc');

    fireEvent.click(row('e-goblin'));
    fireEvent.click(await screen.findByRole('button', { name: 'Duplicate' }));

    await vi.waitFor(() => expect(duplicateEntity).toHaveBeenCalledTimes(1));
    expect(duplicateEntity).toHaveBeenCalledWith('card', 'goblin', expect.objectContaining({ id: 'e-goblin' }));
  });

  it('duplicates every selected item, in tree order, but no folders', async () => {
    renderTree();
    await screen.findByText('Orc');

    fireEvent.click(row('e-orc'));
    fireEvent.click(row('e-goblin'), { ctrlKey: true });
    fireEvent.click(row('maps'), { ctrlKey: true });
    fireEvent.click(await screen.findByRole('button', { name: 'Duplicate' }));

    await vi.waitFor(() => expect(duplicateEntity).toHaveBeenCalledTimes(2));
    expect(duplicateEntity.mock.calls.map(([, id]) => id)).toEqual(['goblin', 'orc']);
  });

  it('exports the selected item as a file, with its files when asked', async () => {
    const exported = { format: 'nordvik-entity', kind: 'card', name: 'Orc', data: {} };
    exportEntity.mockResolvedValue(exported);
    renderTree();
    await screen.findByText('Orc');

    fireEvent.click(row('e-orc'));
    fireEvent.click(await screen.findByRole('button', { name: 'Export JSON' }));
    await userEvent.click(await screen.findByRole('checkbox', { name: /Include files/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    await vi.waitFor(() => expect(downloadJson).toHaveBeenCalledWith('Orc.card.json', exported));
    expect(exportEntity).toHaveBeenCalledWith('card', 'orc', { includeFiles: true });
  });

  it('imports pasted JSON into the selected folder and says what was not found', async () => {
    importEntity.mockResolvedValue({ id: 'new', missing: ['portrait.png'] });
    renderTree();
    await screen.findByText('Orc');

    fireEvent.click(row('maps'));
    fireEvent.click(await screen.findByRole('button', { name: 'Import JSON' }));
    const json = { format: 'nordvik-entity', version: 1, kind: 'card', name: 'Hero', data: { name: 'Hero' } };
    fireEvent.change(await screen.findByLabelText('Exported JSON'), { target: { value: JSON.stringify(json) } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await vi.waitFor(() => expect(importEntity).toHaveBeenCalledWith(json, { kind: 'card', parentId: 'maps' }));
    await vi.waitFor(() => expect(toaster.create).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('portrait.png') })));
  });

  it('shows why an import failed', async () => {
    renderTree();
    await screen.findByText('Orc');

    fireEvent.click(await screen.findByRole('button', { name: 'Import JSON' }));
    fireEvent.change(await screen.findByLabelText('Exported JSON'), { target: { value: '{"nope":1}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(await screen.findByText(/isn't an exported map, card or playlist/)).toBeTruthy();
    expect(importEntity).not.toHaveBeenCalled();
  });

  it('offers none of it to whoever cannot edit the game', async () => {
    renderTree({ canEditFolders: false });
    await screen.findByText('Orc');

    fireEvent.click(row('e-orc'));

    expect(screen.queryByRole('button', { name: 'Duplicate' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Import JSON' })).toBeNull();
  });
});

describe('DTreeList Export JSON of a map', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    WebHelper.get.mockImplementation((url, ok) => ok(tree));
  });

  it("offers to bring the tokens' cards", async () => {
    exportEntity.mockResolvedValue({ format: 'nordvik-entity', kind: 'map', name: 'Orc', data: {} });
    renderWithProviders(<div style={{ height: 600 }}><DTreeList entityType="Card" items={items} canEditFolders transferKind="map" /></div>);
    await screen.findByText('Orc');

    fireEvent.click(row('e-orc'));
    fireEvent.click(await screen.findByRole('button', { name: 'Export JSON' }));
    await userEvent.click(await screen.findByRole('checkbox', { name: /tokens' cards/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    await vi.waitFor(() => expect(exportEntity).toHaveBeenCalledWith('map', 'orc', { includeFiles: false, includeCards: true }));
  });

  it('offers no cards for anything but a map', async () => {
    renderWithProviders(<div style={{ height: 600 }}><DTreeList entityType="Card" items={items} canEditFolders transferKind="card" /></div>);
    await screen.findByText('Orc');

    fireEvent.click(row('e-orc'));
    fireEvent.click(await screen.findByRole('button', { name: 'Export JSON' }));

    await screen.findByRole('checkbox', { name: /Include files/ });
    expect(screen.queryByRole('checkbox', { name: /tokens' cards/ })).toBeNull();
  });
});
