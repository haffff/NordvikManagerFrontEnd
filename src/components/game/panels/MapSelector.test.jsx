import React from 'react';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '../../../setupTests';
import { MapSelector } from './MapSelector';

// Capture Subscribable handlers by commandPrefix so we can fire synthetic
// WebSocket events in tests.
const subscribableHandlers = {};
vi.mock('../../uiComponents/base/Subscribable', () => ({
  default: ({ commandPrefix, onMessage }) => {
    subscribableHandlers[commandPrefix] = onMessage;
    return null;
  },
}));

vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: {
    getAsync: vi.fn(),
    get: vi.fn(),
  },
  ActiveTransportManager: {
    Subscribe: vi.fn(),
    Unsubscribe: vi.fn(),
    Send: vi.fn(),
    WebSocketReady: true,
  },
}));

vi.mock('../../../ClientMediator', () => ({
  default: {
    sendCommandWaitForRegister: vi.fn(() => Promise.resolve(null)),
    // MaterialChooser pulls in ProgressToastManager, which calls ClientMediator.on(...)
    // at module load time to wire up its Progress:* listeners.
    on: vi.fn(() => vi.fn()),
    off: vi.fn(),
  },
}));

vi.mock('@hlorenzi/react-dockable', () => ({
  useContentContext: vi.fn(() => ({ setTitle: vi.fn(), setPreferredSize: vi.fn() })),
  spawnFloating: vi.fn(),
}));

vi.mock('../../uiComponents/hooks/useBattleMapName', () => ({
  default: () => 'Test BM',
}));

let canEditGame = true;
vi.mock('../../../contexts/PermissionsContext', () => ({
  usePermissions: () => ({ canEditGame, hasEntityPermission: () => true }),
}));

import { ActiveWebHelper, ActiveTransportManager } from '../../../helpers/transport';
import ClientMediator from '../../../ClientMediator';
import * as Dockable from '@hlorenzi/react-dockable';

const MAPS = [
  { id: 'map-1', name: 'Forest' },
  { id: 'map-2', name: 'Cave' },
];

// The maps' folder tree, as battlemap/getTree?entityType=MapModel returns it.
let treeEntries;
const TOP_LEVEL = [
  { id: 'e-1', targetId: 'map-1', head: true, next: 'e-2' },
  { id: 'e-2', targetId: 'map-2' },
];
const serveTree = (otherwise) => (url, cb) =>
  url.startsWith('battlemap/getTree') ? cb(treeEntries) : otherwise?.(url, cb);

const mockState = {};

describe('MapSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canEditGame = true;
    // Clear captured handlers between tests
    Object.keys(subscribableHandlers).forEach((k) => delete subscribableHandlers[k]);
    ActiveWebHelper.getAsync.mockResolvedValue(MAPS);
    treeEntries = TOP_LEVEL;
    ActiveWebHelper.get.mockImplementation(serveTree());
    ClientMediator.sendCommandWaitForRegister.mockResolvedValue(null);
  });

  // ── loading & rendering ────────────────────────────────────────────────────

  it('shows a loading spinner while maps are fetching', () => {
    // Hang the fetch so the component stays in loading state
    ActiveWebHelper.getAsync.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<MapSelector battleMapId="bm-1" state={mockState} />);
    expect(screen.getByText(/loading maps/i)).toBeInTheDocument();
  });

  it('renders map names after data loads', async () => {
    renderWithProviders(<MapSelector battleMapId="bm-1" state={mockState} />);
    await waitFor(() => {
      expect(screen.getByText('Forest')).toBeInTheDocument();
      expect(screen.getByText('Cave')).toBeInTheDocument();
    });
  });

  it('shows the empty state when there are no maps', async () => {
    ActiveWebHelper.getAsync.mockResolvedValue([]);
    renderWithProviders(<MapSelector battleMapId="bm-1" state={mockState} />);
    await waitFor(() => {
      expect(screen.getByText(/no items/i)).toBeInTheDocument();
    });
  });

  // ── active map indicator ───────────────────────────────────────────────────

  it('shows the "Active" badge for the currently selected map', async () => {
    // The component resolves the selected map from ClientMediator
    ClientMediator.sendCommandWaitForRegister.mockResolvedValue('map-1');
    renderWithProviders(<MapSelector battleMapId="bm-1" state={mockState} />);
    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  it('shows "Active" only on the selected map, not on others', async () => {
    ClientMediator.sendCommandWaitForRegister.mockResolvedValue('map-1');
    renderWithProviders(<MapSelector battleMapId="bm-1" state={mockState} />);
    await waitFor(() => {
      // Only one "Active" label should exist
      expect(screen.getAllByText('Active')).toHaveLength(1);
    });
  });

  // ── interactions ───────────────────────────────────────────────────────────

  it('sends a map_change command when a map row is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MapSelector battleMapId="bm-1" state={mockState} />);
    await waitFor(() => expect(screen.getByText('Forest')).toBeInTheDocument());

    await user.click(screen.getByText('Forest'));

    expect(ActiveTransportManager.Send).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'map_change',
        data: expect.objectContaining({ mapId: 'map-1' }),
      })
    );
  });

  it('sends a map_add command when the add button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MapSelector battleMapId="bm-1" state={mockState} />);
    await waitFor(() => expect(screen.getByText('Forest')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /add item/i }));

    expect(ActiveTransportManager.Send).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'map_add' })
    );
  });

  // Like the Cards list: a row's actions are in the toolbar (and right-click) once it's selected.
  it('removes the selected map from the toolbar', async () => {
    const user = userEvent.setup();
    ClientMediator.sendCommandWaitForRegister.mockResolvedValue('map-1');
    renderWithProviders(<MapSelector battleMapId="bm-1" state={mockState} />);
    await waitFor(() => expect(screen.getByText('Cave')).toBeInTheDocument());

    await user.click(screen.getByText('Cave'));
    await user.click(await screen.findByRole('button', { name: /^remove$/i }));

    expect(ActiveTransportManager.Send).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'map_remove', data: 'map-2' })
    );
  });

  it('offers no Remove for the map on show', async () => {
    const user = userEvent.setup();
    ClientMediator.sendCommandWaitForRegister.mockResolvedValue('map-1');
    renderWithProviders(<MapSelector battleMapId="bm-1" state={mockState} />);
    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument());

    await user.click(screen.getByText('Forest'));

    expect(await screen.findByRole('button', { name: /^settings$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^remove$/i })).not.toBeInTheDocument();
  });

  it('shows no actions to whoever cannot edit the game', async () => {
    const user = userEvent.setup();
    canEditGame = false;
    renderWithProviders(<MapSelector battleMapId="bm-1" state={mockState} />);
    await waitFor(() => expect(screen.getByText('Cave')).toBeInTheDocument());

    await user.click(screen.getByText('Cave'));

    expect(screen.queryByRole('button', { name: /^settings$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add item/i })).not.toBeInTheDocument();
  });

  it('calls getAsync and spawnFloating when the Settings button is clicked', async () => {
    const user = userEvent.setup();
    ActiveWebHelper.get.mockImplementation(serveTree((_url, cb) => cb({ id: 'map-1', name: 'Forest' })));
    renderWithProviders(<MapSelector battleMapId="bm-1" state={mockState} />);
    await waitFor(() => expect(screen.getByText('Forest')).toBeInTheDocument());

    await user.click(screen.getByText('Forest'));
    await user.click(await screen.findByRole('button', { name: /^settings$/i }));

    expect(ActiveWebHelper.get).toHaveBeenCalledWith(
      expect.stringContaining('map/get?'),
      expect.any(Function)
    );
    expect(Dockable.spawnFloating).toHaveBeenCalled();
  });

  // ── folders ────────────────────────────────────────────────────────────────

  it('shows maps inside their folders', async () => {
    const user = userEvent.setup();
    treeEntries = [
      { id: 'f-dungeons', isFolder: true, name: 'Dungeons', head: true, next: 'e-1' },
      { id: 'e-2', targetId: 'map-2', parentId: 'f-dungeons', head: true },
      { id: 'e-1', targetId: 'map-1' },
    ];
    renderWithProviders(<MapSelector battleMapId="bm-1" state={mockState} />);
    await waitFor(() => expect(screen.getByText('Dungeons')).toBeInTheDocument());
    expect(screen.getByText('Forest')).toBeInTheDocument();

    // Cave sits in the folder: it shows once the folder is open
    if (!screen.queryByText('Cave')) await user.dblClick(screen.getByText('Dungeons'));
    expect(screen.getByText('Cave')).toBeInTheDocument();
  });

  it('hides folders with nothing in them from whoever cannot edit folders', async () => {
    canEditGame = false;
    treeEntries = [
      { id: 'f-empty', isFolder: true, name: 'Empty folder', head: true, next: 'f-dungeons' },
      { id: 'f-dungeons', isFolder: true, name: 'Dungeons', next: 'e-1' },
      { id: 'e-2', targetId: 'map-2', parentId: 'f-dungeons', head: true },
      { id: 'e-1', targetId: 'map-1' },
    ];
    renderWithProviders(<MapSelector battleMapId="bm-1" state={mockState} />);
    await waitFor(() => expect(screen.getByText('Dungeons')).toBeInTheDocument());
    expect(screen.queryByText('Empty folder')).not.toBeInTheDocument();
  });

  it('keeps empty folders for whoever can edit them', async () => {
    treeEntries = [
      { id: 'f-empty', isFolder: true, name: 'Empty folder', head: true, next: 'e-1' },
      { id: 'e-1', targetId: 'map-1' },
    ];
    renderWithProviders(<MapSelector battleMapId="bm-1" state={mockState} />);
    await waitFor(() => expect(screen.getByText('Empty folder')).toBeInTheDocument());
  });

  it('offers folders to whoever can edit the game', async () => {
    renderWithProviders(<MapSelector battleMapId="bm-1" state={mockState} />);
    await waitFor(() => expect(screen.getByText('Forest')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /add folder/i })).toBeInTheDocument();
  });

  it('deleting a folder with everything in it keeps the active map', async () => {
    const user = userEvent.setup();
    ClientMediator.sendCommandWaitForRegister.mockResolvedValue('map-1');
    treeEntries = [
      { id: 'f-all', isFolder: true, name: 'Everything', head: true },
      { id: 'e-1', targetId: 'map-1', parentId: 'f-all', head: true, next: 'e-2' },
      { id: 'e-2', targetId: 'map-2', parentId: 'f-all' },
    ];
    renderWithProviders(<MapSelector battleMapId="bm-1" state={mockState} />);
    await waitFor(() => expect(screen.getByText('Everything')).toBeInTheDocument());
    await waitFor(() => expect(ClientMediator.sendCommandWaitForRegister).toHaveBeenCalled());

    await user.click(screen.getByText('Everything'));
    await user.click(screen.getByRole('button', { name: /^delete all$/i }));
    const confirm = await screen.findAllByRole('button', { name: /^delete all$/i });
    await user.click(confirm[confirm.length - 1]);

    const removed = ActiveTransportManager.Send.mock.calls.map(([c]) => c).filter((c) => c.command === 'map_remove');
    expect(removed).toEqual([expect.objectContaining({ data: 'map-2' })]);
  });

  // ── settings_map refresh (regression) ─────────────────────────────────────

  it('reloads the map list when a settings_map event arrives (name stays current)', async () => {
    renderWithProviders(<MapSelector battleMapId="bm-1" state={mockState} />);
    await waitFor(() => expect(screen.getByText('Forest')).toBeInTheDocument());

    // Server broadcasts a name change — next fetch returns the updated name
    ActiveWebHelper.getAsync.mockResolvedValue([
      { id: 'map-1', name: 'Renamed Forest' },
      { id: 'map-2', name: 'Cave' },
    ]);

    act(() => {
      subscribableHandlers['settings_map']?.({
        command: 'settings_map_update',
        data: { id: 'map-1', name: 'Renamed Forest' },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Renamed Forest')).toBeInTheDocument();
      expect(screen.queryByText('Forest')).not.toBeInTheDocument();
    });
  });
});
