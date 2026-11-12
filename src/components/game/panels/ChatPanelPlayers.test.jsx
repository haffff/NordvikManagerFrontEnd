import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Provider } from '../../ui/provider';

// The chat shows who sent each message from its own copy of the game's players. On a phone
// it opened while the game was still loading: it took the (empty) list at once, the real one
// arrived as "PlayersChanged" while the history was still on its way, and then the history's
// arrival put the empty list back: "[Unknown]" for every sender until someone joined.

const game = vi.hoisted(() => ({ players: [], events: [], chat: null }));

vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: { getAsync: vi.fn((path) => (path === 'battlemap/getchat' ? game.chat.promise : Promise.resolve(null))) },
  ActiveTransportManager: { Subscribe: vi.fn(), Unsubscribe: vi.fn(), Send: vi.fn() },
}));
vi.mock('../../../ClientMediator', () => ({
  default: {
    register: vi.fn((entry) => { if (entry.onEvent) game.events.push(entry.onEvent); }),
    unregister: vi.fn(),
    fireEvent: vi.fn(),
    sendCommand: vi.fn((panel, command) => {
      if (command === 'GetPlayers') return game.players;
      if (command === 'GetCurrentPlayer') return game.players.find((p) => p.id === 'me');
      if (command === 'GetOwner') return 'gm';
      return undefined;
    }),
  },
}));
vi.mock('@hlorenzi/react-dockable', () => ({ useContentContext: () => ({ setTitle: vi.fn() }) }));
vi.mock('../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));
vi.mock('../dice/DiceRoller', () => ({ default: () => null }));
vi.mock('../../uiComponents/PlayerAvatar', () => ({ default: () => null }));

import { ChatPanel } from './ChatPanel';

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};

describe('ChatPanel senders', () => {
  it('shows who sent a message when the players arrive while the history is loading', async () => {
    game.players = [];
    game.events = [];
    game.chat = deferred();
    render(<Provider><ChatPanel /></Provider>);

    // The game finishes loading its players, and announces them.
    const players = [{ id: 'gm', name: 'Game Master' }, { id: 'me', name: 'playertest' }];
    game.players = players;
    act(() => game.events.forEach((onEvent) => onEvent('PlayersChanged', { all: players, connected: [] })));

    // Then the history arrives.
    await act(async () => {
      game.chat.resolve([{ id: 'm1', playerId: 'gm', data: 'hello from the GM', created: '2026-11-12T16:50:17Z' }]);
    });

    expect(await screen.findByText('Game Master')).toBeTruthy();
    expect(screen.queryByText('[Unknown]')).toBeNull();
  });
});
