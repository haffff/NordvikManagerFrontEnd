import React from 'react';
import { act, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '../../../setupTests';

vi.mock('../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));
vi.mock('@hlorenzi/react-dockable', () => ({ useContentContext: () => ({ setTitle: vi.fn() }) }));
vi.mock('../turnOrder/TurnOrderService', () => {
  const fn = () => vi.fn(() => Promise.resolve(true));
  return {
    TurnOrderService: {
      Next: fn(), Previous: fn(), Sort: fn(), Reset: fn(), EndTurn: fn(), GoTo: fn(),
      Add: fn(), Remove: fn(), SetInitiative: fn(), SetHidden: fn(), Reorder: fn(),
    },
  };
});
vi.mock('../../../ClientMediator', () => ({
  default: {
    sendCommand: vi.fn(),
    sendCommandAsync: vi.fn(async (panel, command) => (command === 'GetActiveBattleMapId' ? 'bm-1' : undefined)),
  },
}));

import ClientMediator from '../../../ClientMediator';
import { TurnOrderService } from '../turnOrder/TurnOrderService';
import { setTurnOrderState } from '../turnOrder/turnOrderStore';
import { TurnOrderPanel } from './TurnOrderPanel';

const entries = [
  { id: 'e1', name: 'Hero', initiative: 18, elementId: 't1', hidden: false },
  { id: 'e2', name: 'Goblin', initiative: 12, elementId: 't2', hidden: true },
  { id: 'e3', name: 'Lair action', initiative: 20, elementId: null, hidden: false },
];
const gmState = { mapId: 'map-1', round: 2, currentEntryId: 'e1', currentHidden: false, canEdit: true, canEndTurn: true, entries };
const playerState = (over) => ({
  mapId: 'map-1', round: 2, currentEntryId: 'e1', currentHidden: false, canEdit: false, canEndTurn: false,
  entries: entries.filter((e) => !e.hidden), ...over,
});

const show = (state) => {
  act(() => setTurnOrderState(state));
  return renderWithProviders(<TurnOrderPanel />);
};
const row = (name) => screen.getByText(name).closest('[data-entry]');

describe('TurnOrderPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    act(() => setTurnOrderState(null));
  });

  it('without a map on screen, says so', () => {
    show(null);
    expect(screen.getByText(/open a battle map/i)).toBeInTheDocument();
  });

  describe('as the GM', () => {
    it('shows the round, every entry (hidden ones marked) and whose turn it is', () => {
      show(gmState);

      expect(screen.getByText('Round 2')).toBeInTheDocument();
      expect(row('Hero')).toHaveAttribute('aria-current', 'true');
      expect(row('Goblin')).toHaveAttribute('data-hidden', 'true');
      expect(row('Lair action')).toHaveAttribute('aria-current', 'false');
    });

    it('Previous, Next, Sort and Reset drive the order', async () => {
      show(gmState);

      await userEvent.click(screen.getByRole('button', { name: 'Previous turn' }));
      await userEvent.click(screen.getByRole('button', { name: 'Next turn' }));
      await userEvent.click(screen.getByRole('button', { name: 'Sort by initiative' }));
      await userEvent.click(screen.getByRole('button', { name: 'Restart at round 1' }));

      expect(TurnOrderService.Previous).toHaveBeenCalled();
      expect(TurnOrderService.Next).toHaveBeenCalled();
      expect(TurnOrderService.Sort).toHaveBeenCalled();
      expect(TurnOrderService.Reset).toHaveBeenCalledWith({ clear: false });
    });

    it('initiative is saved when leaving the field', async () => {
      show(gmState);
      const field = screen.getByRole('textbox', { name: 'Initiative of Goblin' });

      await userEvent.clear(field);
      await userEvent.type(field, '14');
      fireEvent.blur(field);

      expect(TurnOrderService.SetInitiative).toHaveBeenCalledWith({ entryId: 'e2', initiative: '14' });
    });

    it('entries can be hidden, shown, removed, made current, and free entries added', async () => {
      show(gmState);

      await userEvent.click(screen.getByRole('button', { name: 'Show Goblin to players' }));
      await userEvent.click(screen.getByRole('button', { name: 'Hide Hero from players' }));
      await userEvent.click(screen.getByRole('button', { name: 'Remove Lair action' }));
      await userEvent.click(screen.getByRole('button', { name: "Make it Goblin's turn" }));
      await userEvent.type(screen.getByRole('textbox', { name: 'New entry' }), 'Reinforcements{Enter}');

      expect(TurnOrderService.SetHidden).toHaveBeenCalledWith({ entryId: 'e2', hidden: false });
      expect(TurnOrderService.SetHidden).toHaveBeenCalledWith({ entryId: 'e1', hidden: true });
      expect(TurnOrderService.Remove).toHaveBeenCalledWith({ entryIds: ['e3'] });
      expect(TurnOrderService.GoTo).toHaveBeenCalledWith({ entryId: 'e2' });
      expect(TurnOrderService.Add).toHaveBeenCalledWith({ name: 'Reinforcements' });
    });
  });

  describe('as a player', () => {
    it('sees no editing controls', () => {
      show(playerState());

      expect(screen.queryByRole('button', { name: 'Next turn' })).toBeNull();
      expect(screen.queryByRole('textbox', { name: /Initiative of/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
      expect(screen.getByText('18')).toBeInTheDocument();
    });

    it("on a hidden entry's turn, sees that someone unseen is acting", () => {
      show(playerState({ currentEntryId: null, currentHidden: true }));

      expect(screen.getByLabelText('A hidden turn')).toBeInTheDocument();
      expect(row('Hero')).toHaveAttribute('aria-current', 'false');
    });

    it('can end their own turn, and only then', async () => {
      const view = show(playerState({ canEndTurn: true }));
      await userEvent.click(screen.getByRole('button', { name: 'End my turn' }));
      expect(TurnOrderService.EndTurn).toHaveBeenCalled();

      view.unmount();
      show(playerState({ canEndTurn: false }));
      expect(screen.queryByRole('button', { name: 'End my turn' })).toBeNull();
    });
  });

  it("clicking a token's entry shows it on the map", async () => {
    show(playerState());

    await userEvent.click(screen.getByText('Hero'));

    await waitFor(() => expect(ClientMediator.sendCommand).toHaveBeenCalledWith('BattleMap', 'FocusElement', { contextId: 'bm-1', elementId: 't1' }));
  });
});
