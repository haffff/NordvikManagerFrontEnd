import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: { getAsync: vi.fn() },
  ActiveTransportManager: { Send: vi.fn() },
}));
vi.mock('../../../ClientMediator', () => ({
  default: {
    sendCommand: vi.fn(),
    sendCommandAsync: vi.fn(),
  },
}));

import ClientMediator from '../../../ClientMediator';
import { ActiveWebHelper as WebHelper, ActiveTransportManager as Transport } from '../../../helpers/transport';
import { TurnOrderService } from './TurnOrderService';

const sent = () => Transport.Send.mock.calls.map(([message]) => message);

describe('TurnOrderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The active battle map view shows map "map-1".
    ClientMediator.sendCommandAsync.mockImplementation(async (panel, command) =>
      panel === 'Game' && command === 'GetActiveBattleMapId' ? 'bm-1' : undefined);
    ClientMediator.sendCommand.mockImplementation((panel, command, data) =>
      panel === 'BattleMap' && command === 'GetSelectedMap' && data?.contextId === 'bm-1' ? { id: 'map-1' } : undefined);
  });

  it('is the "TurnOrder" panel, with every command documented for the Run dialog', () => {
    expect(TurnOrderService.panel).toBe('TurnOrder');
    for (const name of ['GetState', 'Add', 'Remove', 'SetInitiative', 'SetHidden', 'Reorder', 'Sort', 'Next', 'Previous', 'GoTo', 'EndTurn', 'Reset', 'Open']) {
      expect(typeof TurnOrderService[name]).toBe('function');
      expect(TurnOrderService.$meta[name]?.description).toBeTruthy();
    }
  });

  it('Next and Previous advance the turn order of the map on screen', async () => {
    await TurnOrderService.Next();
    await TurnOrderService.Previous();

    expect(sent()).toEqual([
      { command: 'turnorder_advance', data: { mapId: 'map-1', direction: 1 } },
      { command: 'turnorder_advance', data: { mapId: 'map-1', direction: -1 } },
    ]);
  });

  it('a given mapId wins over the map on screen', async () => {
    await TurnOrderService.Sort({ mapId: 'map-9' });

    expect(sent()).toEqual([{ command: 'turnorder_sort', data: { mapId: 'map-9' } }]);
  });

  it('Add takes tokens and/or a free entry', async () => {
    await TurnOrderService.Add({ elementIds: ['t1', 't2'], initiative: 12 });
    await TurnOrderService.Add({ name: 'Lair action', initiative: 20, hidden: true });

    expect(sent()).toEqual([
      { command: 'turnorder_add', data: { mapId: 'map-1', entries: [{ elementId: 't1', initiative: 12 }, { elementId: 't2', initiative: 12 }] } },
      { command: 'turnorder_add', data: { mapId: 'map-1', entries: [{ name: 'Lair action', initiative: 20, hidden: true }] } },
    ]);
  });

  it('SetInitiative sets a number, or clears it when empty, and can sort', async () => {
    await TurnOrderService.SetInitiative({ entryId: 'e1', initiative: '15', sort: true });
    await TurnOrderService.SetInitiative({ elementId: 't1', initiative: '' });

    expect(sent()).toEqual([
      { command: 'turnorder_update', data: { mapId: 'map-1', entryId: 'e1', initiative: 15, sortAfter: true } },
      { command: 'turnorder_update', data: { mapId: 'map-1', elementId: 't1', clearInitiative: true, sortAfter: false } },
    ]);
  });

  it('EndTurn, GoTo, Reset and Remove send their commands', async () => {
    await TurnOrderService.EndTurn();
    await TurnOrderService.GoTo({ entryId: 'e2' });
    await TurnOrderService.Reset({ clear: true });
    await TurnOrderService.Remove({ entryIds: ['e3'] });

    expect(sent()).toEqual([
      { command: 'turnorder_end_turn', data: { mapId: 'map-1' } },
      { command: 'turnorder_advance', data: { mapId: 'map-1', entryId: 'e2' } },
      { command: 'turnorder_reset', data: { mapId: 'map-1', clear: true } },
      { command: 'turnorder_remove', data: { mapId: 'map-1', entryIds: ['e3'] } },
    ]);
  });

  it('GetState reads what this player may see', async () => {
    WebHelper.getAsync.mockResolvedValue({ mapId: 'map-1', round: 2, entries: [] });

    const state = await TurnOrderService.GetState();

    expect(WebHelper.getAsync).toHaveBeenCalledWith('TurnOrder?mapId=map-1');
    expect(state.round).toBe(2);
  });

  it('does nothing without a map on screen', async () => {
    ClientMediator.sendCommand.mockReturnValue(undefined);

    expect(await TurnOrderService.Next()).toBe(false);
    expect(await TurnOrderService.GetState()).toBeNull();
    expect(Transport.Send).not.toHaveBeenCalled();
  });
});
