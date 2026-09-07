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
});
