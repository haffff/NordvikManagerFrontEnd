import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../setupTests';

vi.mock('@hlorenzi/react-dockable', () => ({ useContentContext: () => ({ setTitle: vi.fn(), setPreferredSize: vi.fn() }) }));
vi.mock('../../uiComponents/base/Subscribable', () => ({ default: ({ children }) => <>{children}</> }));
vi.mock('./SettingsPanel', () => ({ default: ({ dto }) => <div data-testid="player-fields">{dto?.name}</div> }));
vi.mock('../theme/StylesheetSettings', () => ({ PersonalStylesheetSettings: () => <div>Personal stylesheets</div> }));
vi.mock('./AudioVolumeSettings', () => ({ default: () => <div>Sound volume</div> }));
vi.mock('./ResourceCacheSettings', () => ({ default: () => <div>Offline cache</div> }));
vi.mock('../../../helpers/transport', () => ({
  ActiveTransportManager: { Send: vi.fn() },
  ActiveWebHelper: { GameId: 'game-1' },
}));

const me = { id: 'p-me', name: 'Me' };
const other = { id: 'p-other', name: 'Other' };
vi.mock('../../../ClientMediator', () => ({
  default: {
    sendCommand: vi.fn((panel, cmd) => (cmd === 'GetCurrentPlayer' ? me : undefined)),
    sendCommandWaitForRegisterAsync: vi.fn(async (panel, cmd, data) => (data.id === 'p-me' ? me : other)),
  },
}));

import { PlayerSettingsPanel } from './PlayerSettingsPanel';

describe('PlayerSettingsPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  // Settings → Player opened it with a `player` looked up once when the toolbar
  // mounted — usually before the player list had loaded, so it stayed undefined
  // (and a layout restore drops it too). Without a player it's your own settings.
  it('without a player, shows your own settings, including the ones kept in this browser', async () => {
    renderWithProviders(<PlayerSettingsPanel />);

    await waitFor(() => expect(screen.getByTestId('player-fields')).toHaveTextContent('Me'));
    // Their own tab: under the full-height player form they were clipped out of view.
    fireEvent.click(screen.getByRole('tab', { name: 'This browser' }));
    expect(await screen.findByText('Sound volume')).toBeVisible();
    expect(screen.getByText('Personal stylesheets')).toBeInTheDocument();
    expect(screen.getByText('Offline cache')).toBeInTheDocument();
  });

  it("another player's settings don't show your browser's settings", async () => {
    renderWithProviders(<PlayerSettingsPanel player={other} />);

    await waitFor(() => expect(screen.getByTestId('player-fields')).toHaveTextContent('Other'));
    expect(screen.queryByRole('tab', { name: 'This browser' })).not.toBeInTheDocument();
    expect(screen.queryByText('Sound volume')).not.toBeInTheDocument();
  });
});
