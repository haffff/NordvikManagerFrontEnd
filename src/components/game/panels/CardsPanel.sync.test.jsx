import React from 'react';
import { screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '../../../setupTests';

// The Cards panel with its real syncer and tree: what other players' changes look like.
const { subs, server } = vi.hoisted(() => ({
  subs: new Map(),
  server: { cards: [], tree: [] },
}));

vi.mock('../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));
vi.mock('@hlorenzi/react-dockable', () => ({ useContentContext: () => ({ setTitle: vi.fn() }) }));
vi.mock('../../../contexts/PermissionsContext', () => ({
  usePermissions: () => ({ hasEntityPermission: () => true, isGM: true, isAdmin: true }),
}));
vi.mock('../../../ClientMediator', () => ({
  default: {
    sendCommand: vi.fn((panel, command) => (command === 'GetCurrentPlayer' ? { id: 'player-1' } : undefined)),
    sendCommandAsync: vi.fn(async () => undefined),
    on: vi.fn(),
    off: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn(),
  },
}));
vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: {
    getAsync: vi.fn(async (path) => (path === 'materials/getcards' ? server.cards.map((c) => ({ ...c })) : [])),
    get: vi.fn((path, ok) => ok(path.startsWith('battlemap/getTree') ? server.tree.map((e) => ({ ...e })) : [])),
  },
  ActiveTransportManager: {
    Send: vi.fn(),
    Subscribe: vi.fn((key, cb) => subs.set(key, cb)),
    Unsubscribe: vi.fn((key) => subs.delete(key)),
  },
}));
vi.mock('./CardPanel', () => ({ default: () => null }));
vi.mock('../settings/CardSettingsPanel', () => ({ default: () => null }));

import { CardsPanel } from './CardsPanel';

const broadcast = (message) => act(() => { [...subs.values()].forEach((cb) => cb({ result: 'Ok', ...message })); });
const entry = (id, targetId) => ({ id, targetId, isFolder: false, entryType: 'CardModel', parentId: null, next: null });

describe('CardsPanel, live updates', () => {
  beforeEach(() => {
    subs.clear();
    server.cards = [];
    server.tree = [];
  });

  it('a card someone creates shows up without refreshing the panel', async () => {
    renderWithProviders(<CardsPanel state={{}} />);
    await screen.findByText('No items');

    // The server files the new card in the folder tree, but only announces the card.
    server.cards = [{ id: 'c1', name: 'Goblin' }];
    server.tree = [entry('e1', 'c1')];
    broadcast({ command: 'card_add', data: { id: 'c1', name: 'Goblin' } });

    expect(await screen.findByText('Goblin')).toBeInTheDocument();
  });

  it('a renamed card shows its new name', async () => {
    server.cards = [{ id: 'c1', name: 'Goblin' }];
    server.tree = [entry('e1', 'c1')];
    renderWithProviders(<CardsPanel state={{}} />);
    await screen.findByText('Goblin');

    broadcast({ command: 'card_update', data: { id: 'c1', name: 'Hobgoblin' } });

    expect(await screen.findByText('Hobgoblin')).toBeInTheDocument();
  });
});
