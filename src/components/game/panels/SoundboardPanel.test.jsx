import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../../setupTests';

// The soundboard panel shows its boards in a folder tree (tree entries labelled "Soundboard").

const subscribers = {};
vi.mock('../../uiComponents/base/Subscribable', () => ({
  default: ({ commandPrefix, onMessage }) => { subscribers[commandPrefix] = onMessage; return null; },
}));
vi.mock('../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));
vi.mock('../../uiComponents/base/Modals/InputModal', () => ({ default: () => null }));
vi.mock('../settings/SettingsPanel', () => ({
  default: ({ dto }) => <div data-testid="settings">Editing {dto?.name}</div>,
}));
vi.mock('../../../contexts/PermissionsContext', () => ({ usePermissions: () => ({ canEditGame: true }) }));
vi.mock('@hlorenzi/react-dockable', () => ({ useContentContext: () => ({ setTitle: vi.fn() }) }));

const playlists = [
  { id: 'p1', name: 'Battle drums', resources: [{ id: 'r1', name: 'Drum hit' }] },
  { id: 'p2', name: 'Tavern', resources: [{ id: 'r2', name: 'Door creak' }], volume: 0.6 },
];
const tree = [
  { id: 'f-combat', isFolder: true, name: 'Combat', head: true, next: 'e-p2', entryType: 'Soundboard' },
  { id: 'e-p2', targetId: 'p2', entryType: 'Soundboard' },
  { id: 'e-p1', targetId: 'p1', head: true, parentId: 'f-combat', entryType: 'Soundboard' },
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
import { SoundboardPanel } from './SoundboardPanel';
import { playingSounds } from '../../../helpers/playingSounds';

const treeRequests = () => WebHelper.get.mock.calls.filter(([url]) => url.startsWith('battlemap/getTree'));

describe('SoundboardPanel folder tree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    playingSounds.clear();
    ClientMediator.sendCommandAsync.mockImplementation(async (panel, cmd) => {
      if (cmd === 'GetPlaylists') return playlists;
      if (cmd === 'GetCurrentPlayback') return [];
      if (cmd === 'AddPlaylist') return { status: 200, body: { id: 'p3' } };
      if (cmd === 'Play') return { status: 200, body: {} };
      return undefined;
    });
    WebHelper.get.mockImplementation((url, ok) => { if (url.startsWith('battlemap/getTree')) ok(tree); });
  });

  it('loads the Soundboard folder tree', async () => {
    renderWithProviders(<SoundboardPanel />);
    await waitFor(() => expect(treeRequests().length).toBeGreaterThan(0));
    expect(treeRequests()[0][0]).toBe('battlemap/getTree?entityType=Soundboard');
  });

  it('shows boards inside their folders', async () => {
    renderWithProviders(<SoundboardPanel />);
    expect(await screen.findByText('Combat')).toBeInTheDocument();
    expect(screen.getByText('Tavern')).toBeInTheDocument();
    expect(screen.queryByText('Battle drums')).not.toBeInTheDocument();
    fireEvent.doubleClick(screen.getByText('Combat'));
    expect(await screen.findByText('Battle drums')).toBeInTheDocument();
  });

  it('selecting a board opens it in the detail pane', async () => {
    renderWithProviders(<SoundboardPanel />);
    fireEvent.click(await screen.findByText('Tavern'));
    expect(await screen.findByLabelText('Delete soundboard')).toBeInTheDocument();
  });

  it('only real changes refresh the tree, not every sound played', async () => {
    renderWithProviders(<SoundboardPanel />);
    await screen.findByText('Tavern');
    const before = treeRequests().length;
    subscribers.playlist?.({ command: 'sound_play', data: {} });
    await new Promise((r) => setTimeout(r, 20));
    expect(treeRequests().length).toBe(before);
    subscribers.playlist?.({ command: 'playlist_notify', data: {} });
    await waitFor(() => expect(treeRequests().length).toBeGreaterThan(before));
  });

  it('refreshes the tree after adding a board', async () => {
    renderWithProviders(<SoundboardPanel />);
    await screen.findByText('Tavern');
    const before = treeRequests().length;
    fireEvent.click(screen.getByText('New Soundboard'));
    await waitFor(() => expect(treeRequests().length).toBeGreaterThan(before));
  });

  it("a sound is played from its soundboard, so the soundboard's volume applies", async () => {
    renderWithProviders(<SoundboardPanel />);
    fireEvent.click(await screen.findByText('Tavern'));

    fireEvent.click(await screen.findByText('Door creak'));

    await waitFor(() => expect(ClientMediator.sendCommandAsync).toHaveBeenCalledWith('Playlist', 'PlaySound', { resourceId: 'r2', soundboardId: 'p2' }));
  });

  // One button per sound: a click plays it, a click while it plays stops it.
  it('a playing sound lights up, with its progress, and a click stops it', async () => {
    renderWithProviders(<SoundboardPanel />);
    fireEvent.click(await screen.findByText('Tavern'));
    expect(await screen.findByRole('button', { name: 'Play Door creak' })).toBeInTheDocument();

    act(() => playingSounds.started('r2', { currentTime: 1, duration: 4 }));

    const stop = await screen.findByRole('button', { name: 'Stop Door creak' });
    expect(screen.getByRole('progressbar', { name: 'Door creak' })).toBeInTheDocument();
    fireEvent.click(stop);
    await waitFor(() => expect(ClientMediator.sendCommandAsync).toHaveBeenCalledWith('Playlist', 'StopSound', { resourceId: 'r2' }));
    expect(ClientMediator.sendCommandAsync).not.toHaveBeenCalledWith('Playlist', 'PlaySound', expect.anything());

    act(() => playingSounds.ended('r2'));
    expect(await screen.findByRole('button', { name: 'Play Door creak' })).toBeInTheDocument();
  });

  it('Stop all silences every sound', async () => {
    renderWithProviders(<SoundboardPanel />);
    fireEvent.click(await screen.findByText('Tavern'));

    fireEvent.click(await screen.findByRole('button', { name: 'Stop all sounds' }));

    await waitFor(() => expect(ClientMediator.sendCommandAsync).toHaveBeenCalledWith('Playlist', 'StopAllSounds', {}));
  });

  it("a sound's loop button saves it as looped on its soundboard, and back", async () => {
    renderWithProviders(<SoundboardPanel />);
    fireEvent.click(await screen.findByText('Tavern'));

    const loop = await screen.findByRole('button', { name: 'Loop Door creak' });
    expect(loop).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(loop);

    await waitFor(() => expect(ClientMediator.sendCommandAsync).toHaveBeenCalledWith('Playlist', 'SetLoopedSounds', { playlist: playlists[1], resourceIds: ['r2'] }));
  });

  it('a looped sound shows it, and its loop button takes it off', async () => {
    const looped = [{ ...playlists[0] }, { ...playlists[1], loopedResourceIds: ['r2'] }];
    ClientMediator.sendCommandAsync.mockImplementation(async (panel, cmd) => (cmd === 'GetPlaylists' ? looped : { status: 200, body: {} }));
    renderWithProviders(<SoundboardPanel />);
    fireEvent.click(await screen.findByText('Tavern'));

    const loop = await screen.findByRole('button', { name: 'Loop Door creak' });
    expect(loop).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(loop);

    await waitFor(() => expect(ClientMediator.sendCommandAsync).toHaveBeenCalledWith('Playlist', 'SetLoopedSounds', { playlist: looped[1], resourceIds: [] }));
  });

  it('each soundboard has a volume slider that saves its volume', async () => {
    renderWithProviders(<SoundboardPanel />);
    const slider = await screen.findByRole('slider', { name: 'Volume of Tavern' });
    expect(slider).toHaveValue('60');

    fireEvent.change(slider, { target: { value: '30' } });
    fireEvent.pointerUp(slider);

    await waitFor(() => expect(ClientMediator.sendCommandAsync).toHaveBeenCalledWith('Playlist', 'SetVolume', { playlist: playlists[1], volume: 0.3 }));
  });
});
