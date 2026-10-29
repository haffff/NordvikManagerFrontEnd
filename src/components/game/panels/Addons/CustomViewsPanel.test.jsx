import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { renderWithProviders } from '../../../../setupTests';

// The views panel shows its views in a folder tree (tree entries labelled "CustomView").

const syncerProps = {};
vi.mock('../../../uiComponents/base/CollectionSyncer', () => ({
  default: (props) => { Object.assign(syncerProps, props); return null; },
}));
vi.mock('../../../uiComponents/base/Subscribable', () => ({ default: () => null }));
vi.mock('../../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));
vi.mock('../../../uiComponents/base/Modals/InputModal', () => ({ default: () => null }));
vi.mock('../../settings/SettingsPanelWithPropertySettings', () => ({
  SettingsPanelWithPropertySettings: ({ dto }) => <div data-testid="settings">Editing {dto.name}</div>,
}));
vi.mock('@hlorenzi/react-dockable', () => ({
  useContentContext: () => ({ setTitle: vi.fn() }),
}));
vi.mock('../../../../ClientMediator', () => ({
  default: { sendCommand: vi.fn((panel, cmd) => (cmd === 'GetGameId' ? 'game-1' : undefined)) },
}));

const views = [
  { id: 'v1', name: 'Initiative tracker' },
  { id: 'v2', name: 'Loot table' },
];
const tree = [
  { id: 'f-ui', isFolder: true, name: 'Combat UI', head: true, next: 'e-v2', entryType: 'CustomView' },
  { id: 'e-v2', targetId: 'v2', entryType: 'CustomView' },
  { id: 'e-v1', targetId: 'v1', head: true, parentId: 'f-ui', entryType: 'CustomView' },
];

vi.mock('../../../../helpers/transport', () => ({
  ActiveWebHelper: {
    getAsync: vi.fn(),
    get: vi.fn(),
  },
  ActiveTransportManager: { Send: vi.fn() },
}));

import { ActiveWebHelper as WebHelper } from '../../../../helpers/transport';
import { CustomViewsPanel } from './CustomViewsPanel';

const treeRequests = () => WebHelper.get.mock.calls.filter(([url]) => url.startsWith('battlemap/getTree'));

describe('CustomViewsPanel folder tree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    WebHelper.getAsync.mockImplementation(async (url) => (url === 'materials/getcustomwiews' ? views : null));
    WebHelper.get.mockImplementation((url, ok) => { if (url.startsWith('battlemap/getTree')) ok(tree); });
  });

  it('loads the CustomView folder tree', async () => {
    renderWithProviders(<CustomViewsPanel />);
    await waitFor(() => expect(treeRequests().length).toBeGreaterThan(0));
    expect(treeRequests()[0][0]).toBe('battlemap/getTree?entityType=CustomView');
  });

  it('shows views inside their folders', async () => {
    renderWithProviders(<CustomViewsPanel />);
    expect(await screen.findByText('Combat UI')).toBeInTheDocument();
    expect(screen.getByText('Loot table')).toBeInTheDocument();
    expect(screen.queryByText('Initiative tracker')).not.toBeInTheDocument(); // folder closed
    fireEvent.doubleClick(screen.getByText('Combat UI'));
    expect(await screen.findByText('Initiative tracker')).toBeInTheDocument();
  });

  it('selecting a view opens it in the detail pane', async () => {
    renderWithProviders(<CustomViewsPanel />);
    fireEvent.click(await screen.findByText('Loot table'));
    expect(await screen.findByTestId('settings')).toHaveTextContent('Editing Loot table');
  });

  it('refreshes the tree when a view is added', async () => {
    renderWithProviders(<CustomViewsPanel />);
    await screen.findByText('Loot table');
    const before = treeRequests().length;
    act(() => syncerProps.onAdd?.({ id: 'v3', name: 'New View' }));
    await waitFor(() => expect(treeRequests().length).toBeGreaterThan(before));
  });
});

describe('CustomViewsPanel in a narrow window', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    WebHelper.getAsync.mockImplementation(async (url) => (url === 'materials/getcustomwiews' ? views : null));
    WebHelper.get.mockImplementation((url, ok) => { if (url.startsWith('battlemap/getTree')) ok(tree); });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(360);
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows the list, then the picked view with a way back to the list', async () => {
    renderWithProviders(<CustomViewsPanel />);
    fireEvent.click(await screen.findByText('Loot table'));
    expect(await screen.findByTestId('settings')).toBeVisible();
    expect(screen.getByText('Combat UI')).not.toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /back to views/i }));
    expect(screen.getByTestId('settings')).not.toBeVisible();
    expect(screen.getByText('Combat UI')).toBeVisible();

    // The same view again: its settings come back.
    fireEvent.click(within(screen.getByRole('tree')).getByText('Loot table'));
    expect(screen.getByTestId('settings')).toBeVisible();
  });
});
