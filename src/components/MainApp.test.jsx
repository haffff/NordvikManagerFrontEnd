import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../setupTests';

vi.mock('./FabricTypesInitializer', () => ({ default: vi.fn() }));

vi.mock('./gameLobby/GameList', () => ({
  default: ({ OnSuccess, OnLogout }) => (
    <div>
      <button onClick={() => OnSuccess('game-1')}>select-game</button>
      <button onClick={OnLogout}>logout</button>
    </div>
  ),
}));

vi.mock('./game/Game', () => ({
  Game: ({ onExit }) => <button onClick={onExit}>exit-game</button>,
}));

vi.mock('../helpers/WebHelper', () => ({
  default: { ApiAddress: 'http://api', GameId: undefined },
}));

vi.mock('../helpers/TokenStore', () => ({
  default: { setTokens: vi.fn(), getRefreshToken: vi.fn(() => 'refresh'), clear: vi.fn() },
}));

const { transportCloseMock, isConnectedMock } = vi.hoisted(() => ({
  transportCloseMock: vi.fn(),
  isConnectedMock: vi.fn(() => false), // simulates WebSocketReady already false
}));
vi.mock('../helpers/transport', () => ({
  ActiveTransportManager: { isConnected: isConnectedMock, Close: transportCloseMock },
}));

const { resetPersistedMenuItemsMock } = vi.hoisted(() => ({
  resetPersistedMenuItemsMock: vi.fn(),
}));
vi.mock('./uiComponents/base/DDItems/DropDownMenu', () => ({
  resetPersistedMenuItems: resetPersistedMenuItemsMock,
}));

import MainApp from './MainApp';

async function selectAGame(user) {
  await user.click(await screen.findByText('select-game'));
  await screen.findByText('exit-game');
}

describe('MainApp — handleExit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
    global.fetch = vi.fn((url) => {
      if (String(url).includes('/start')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ centralSessionId: 'central-1', centralAccessToken: 'token' }),
        });
      }
      // .../session/:id/stop — fire-and-forget
      return Promise.resolve({ ok: true, status: 200 });
    });
  });

  // Regression: TransportManager.isConnected() reflects WebSocketReady, not
  // whether a session was ever started. After a PEER_LEFT event or an exit
  // mid-handshake, isConnected() is already false while the transport's
  // WebSocketStarted guard is still true — Close() used to be skipped in that
  // case, stranding the transport so the next Start() call silently no-oped.
  it('calls TransportManager.Close() even when isConnected() is false', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MainApp onAuthRequired={vi.fn()} />);

    await selectAGame(user);
    expect(isConnectedMock()).toBe(false); // sanity: this is the case that used to be skipped

    await user.click(screen.getByText('exit-game'));

    expect(transportCloseMock).toHaveBeenCalledTimes(1);
  });

  // Regression: DropDownMenu's module-level _persistedItems map (addon-added menu
  // items) was never cleared on game exit, so it survived into the next game.
  it('resets persisted addon menu items on exit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MainApp onAuthRequired={vi.fn()} />);

    await selectAGame(user);
    await user.click(screen.getByText('exit-game'));

    expect(resetPersistedMenuItemsMock).toHaveBeenCalledTimes(1);
  });

  it('returns to the game list after exit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MainApp onAuthRequired={vi.fn()} />);

    await selectAGame(user);
    await user.click(screen.getByText('exit-game'));

    expect(await screen.findByText('select-game')).toBeInTheDocument();
  });

  it('removes the ?game= URL param on exit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MainApp onAuthRequired={vi.fn()} />);

    await selectAGame(user);
    expect(new URLSearchParams(window.location.search).get('game')).toBe('game-1');

    await user.click(screen.getByText('exit-game'));
    await screen.findByText('select-game');

    expect(new URLSearchParams(window.location.search).has('game')).toBe(false);
  });
});

// GM build has no equivalent to the player build's URL-param auto-join
// (?game=<centralSessionId>) until now — this covers the new deep-link
// behavior: reading the GM backend's own internal Games.Id (a GUID string,
// NOT Central's centralSessionId — see MainApp.js's own comment) from
// `?game=`, driving it through the exact same handleGameSelected flow a
// manual GameList click already uses, and keeping the URL in sync so a
// plain reload re-enters the same game.
describe('MainApp — GM auto-join from ?game= URL param', () => {
  const GAME_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
    global.fetch = vi.fn((url) => {
      if (String(url).includes('/start')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ centralSessionId: 'central-1', centralAccessToken: 'token' }),
        });
      }
      return Promise.resolve({ ok: true, status: 200 });
    });
  });

  it('renders GameList as before when no ?game= param is present', () => {
    renderWithProviders(<MainApp onAuthRequired={vi.fn()} />);
    expect(screen.getByText('select-game')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('auto-joins exactly once when ?game= is present at mount, and writes it back to the URL', async () => {
    window.history.replaceState({}, '', `/?game=${GAME_ID}`);
    renderWithProviders(<MainApp onAuthRequired={vi.fn()} />);

    await screen.findByText('exit-game');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/session/${GAME_ID}/start`),
      expect.objectContaining({ method: 'POST' })
    );
    expect(new URLSearchParams(window.location.search).get('game')).toBe(GAME_ID);
  });

  it('strips ?game= on a 404 (bad/stale id) so a reload does not retry it', async () => {
    window.history.replaceState({}, '', `/?game=${GAME_ID}`);
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

    renderWithProviders(<MainApp onAuthRequired={vi.fn()} />);

    expect(await screen.findByText(/Failed to start session/i)).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).has('game')).toBe(false);
  });

  it('does NOT strip ?game= on a 500/transient failure so a reload can retry', async () => {
    window.history.replaceState({}, '', `/?game=${GAME_ID}`);
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    renderWithProviders(<MainApp onAuthRequired={vi.fn()} />);

    expect(await screen.findByText(/Failed to start session/i)).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get('game')).toBe(GAME_ID);
  });

  it('a manual GameList selection (no auto-join) still syncs ?game= into the URL', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MainApp onAuthRequired={vi.fn()} />);

    await selectAGame(user);

    expect(new URLSearchParams(window.location.search).get('game')).toBe('game-1');
  });
});
