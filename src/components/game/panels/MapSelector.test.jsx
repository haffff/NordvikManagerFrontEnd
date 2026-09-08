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

import { ActiveWebHelper, ActiveTransportManager } from '../../../helpers/transport';
import ClientMediator from '../../../ClientMediator';
import * as Dockable from '@hlorenzi/react-dockable';

const MAPS = [
  { id: 'map-1', name: 'Forest' },
  { id: 'map-2', name: 'Cave' },
];

const mockState = {};

describe('MapSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear captured handlers between tests
    Object.keys(subscribableHandlers).forEach((k) => delete subscribableHandlers[k]);
    ActiveWebHelper.getAsync.mockResolvedValue(MAPS);
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
      expect(screen.getByText(/no maps yet/i)).toBeInTheDocument();
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

  it('sends a map_remove command when the Remove button is clicked', async () => {
    const user = userEvent.setup();
    // map-1 is active — its Remove button is hidden; map-2's Remove is visible
    ClientMediator.sendCommandWaitForRegister.mockResolvedValue('map-1');
    renderWithProviders(<MapSelector battleMapId="bm-1" state={mockState} />);
    await waitFor(() => expect(screen.getByText('Cave')).toBeInTheDocument());

    // There will be multiple Remove buttons but only map-2's is visible
    const removeBtns = screen.getAllByRole('button', { name: /remove/i });
    // Click the visible one (visibility:visible) — userEvent naturally interacts
    // with visible elements
    const visibleRemove = removeBtns.find(
      (btn) => btn.style.visibility !== 'hidden'
    );
    await user.click(visibleRemove);

    expect(ActiveTransportManager.Send).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'map_remove', data: 'map-2' })
    );
  });

  it('calls getAsync and spawnFloating when the Settings button is clicked', async () => {
    const user = userEvent.setup();
    ActiveWebHelper.get.mockImplementation((_url, cb) => cb({ id: 'map-1', name: 'Forest' }));
    renderWithProviders(<MapSelector battleMapId="bm-1" state={mockState} />);
    await waitFor(() => expect(screen.getByText('Forest')).toBeInTheDocument());

    const settingsBtns = screen.getAllByRole('button', { name: /settings/i });
    await user.click(settingsBtns[0]);

    expect(ActiveWebHelper.get).toHaveBeenCalledWith(
      expect.stringContaining('map/get'),
      expect.any(Function)
    );
    expect(Dockable.spawnFloating).toHaveBeenCalled();
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
