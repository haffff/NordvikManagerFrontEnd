import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../setupTests';

// The playlists panel shows its playlists in a folder tree (tree entries labelled "Playlist").

vi.mock('../../uiComponents/base/Subscribable', () => ({ default: () => null }));
vi.mock('../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));
vi.mock('../../uiComponents/base/Modals/InputModal', () => ({ default: () => null }));
vi.mock('../settings/SettingsPanel', () => ({
  default: ({ dto }) => <div data-testid="settings">Editing {dto?.name}</div>,
}));
vi.mock('../../../contexts/PermissionsContext', () => ({ usePermissions: () => ({ isGM: true }) }));
vi.mock('@hlorenzi/react-dockable', () => ({ useContentContext: () => ({ setTitle: vi.fn() }) }));

const playlists = [
  { id: 'p1', name: 'Battle drums', resources: [], volume: 0.8 },
  { id: 'p2', name: 'Tavern', resources: [] },
];
const tree = [
  { id: 'f-combat', isFolder: true, name: 'Combat', head: true, next: 'e-p2', entryType: 'Playlist' },
  { id: 'e-p2', targetId: 'p2', entryType: 'Playlist' },
  { id: 'e-p1', targetId: 'p1', head: true, parentId: 'f-combat', entryType: 'Playlist' },
];

vi.mock('../../../ClientMediator', () => ({
  default: {
    sendCommand: vi.fn((panel, cmd) => (cmd === 'GetGameId' ? 'game-1' : undefined)),
    sendCommandAsync: vi.fn(),
  },
}));
vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: { get: vi.fn(), getAsync: vi.fn() },
  ActiveTransportManager: { Send: vi.fn() },
}));

import ClientMediator from '../../../ClientMediator';
import { ActiveWebHelper as WebHelper } from '../../../helpers/transport';
import { PlaylistsPanel } from './PlaylistsPanel';

const treeRequests = () => WebHelper.get.mock.calls.filter(([url]) => url.startsWith('battlemap/getTree'));

describe('PlaylistsPanel folder tree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    ClientMediator.sendCommandAsync.mockImplementation(async (panel, cmd) => {
      if (cmd === 'GetPlaylists') return playlists;
      if (cmd === 'GetCurrentPlayback') return [];
      if (cmd === 'AddPlaylist') return { status: 200, body: { id: 'p3' } };
      if (cmd === 'Play') return { status: 200, body: {} };
      return undefined;
    });
    WebHelper.get.mockImplementation((url, ok) => { if (url.startsWith('battlemap/getTree')) ok(tree); });
  });

  it('loads the Playlist folder tree', async () => {
    renderWithProviders(<PlaylistsPanel />);
    await waitFor(() => expect(treeRequests().length).toBeGreaterThan(0));
    expect(treeRequests()[0][0]).toBe('battlemap/getTree?entityType=Playlist');
  });

  it('shows playlists inside their folders', async () => {
    renderWithProviders(<PlaylistsPanel />);
    expect(await screen.findByText('Combat')).toBeInTheDocument();
    expect(screen.getByText('Tavern')).toBeInTheDocument();
    expect(screen.queryByText('Battle drums')).not.toBeInTheDocument();
    fireEvent.doubleClick(screen.getByText('Combat'));
    expect(await screen.findByText('Battle drums')).toBeInTheDocument();
  });

  it('selecting a playlist opens it in the detail pane', async () => {
    renderWithProviders(<PlaylistsPanel />);
    fireEvent.click(await screen.findByText('Tavern'));
    expect(await screen.findByTestId('settings')).toHaveTextContent('Editing Tavern');
  });

  it("a row's play button still plays the playlist", async () => {
    renderWithProviders(<PlaylistsPanel />);
    await screen.findByText('Tavern');
    const row = screen.getAllByRole('treeitem').find((r) => r.textContent.includes('Tavern'));
    fireEvent.click(row.querySelector('[aria-label="Play / Resume"]'));
    await waitFor(() => expect(ClientMediator.sendCommandAsync).toHaveBeenCalledWith('Playlist', 'Play', { playlistId: 'p2' }));
  });

  it('refreshes the tree after adding a playlist', async () => {
    renderWithProviders(<PlaylistsPanel />);
    await screen.findByText('Tavern');
    const before = treeRequests().length;
    fireEvent.click(screen.getByText('New Playlist'));
    await waitFor(() => expect(treeRequests().length).toBeGreaterThan(before));
  });

  it("each playlist has a volume slider that saves its volume", async () => {
    ClientMediator.sendCommandAsync.mockImplementation(async (panel, cmd) => {
      if (cmd === 'GetPlaylists') return playlists;
      if (cmd === 'GetCurrentPlayback') return [];
      if (cmd === 'SetVolume') return { status: 200, body: 0 };
      return undefined;
    });
    renderWithProviders(<PlaylistsPanel />);
    fireEvent.doubleClick(await screen.findByText('Combat')); // Battle drums is in this folder
    const slider = await screen.findByRole('slider', { name: 'Volume of Battle drums' });
    expect(slider).toHaveValue('80');

    fireEvent.change(slider, { target: { value: '50' } });
    fireEvent.pointerUp(slider);

    await waitFor(() => expect(ClientMediator.sendCommandAsync).toHaveBeenCalledWith('Playlist', 'SetVolume', { playlist: playlists[0], volume: 0.5 }));
  });
});
