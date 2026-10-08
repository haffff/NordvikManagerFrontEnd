import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const { ws, events } = vi.hoisted(() => ({ ws: new Map(), events: [] }));

vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: { getAsync: vi.fn() },
  ActiveTransportManager: {
    Send: vi.fn(),
    Subscribe: (key, cb) => ws.set(key, cb),
    Unsubscribe: (key) => ws.delete(key),
  },
}));
vi.mock('../../../ClientMediator', () => ({
  default: {
    register: vi.fn(),
    unregister: vi.fn(),
    sendCommand: vi.fn((panel, command) => (panel === 'BattleMap' && command === 'GetSelectedMap' ? { id: 'map-1' } : undefined)),
    sendCommandAsync: vi.fn(async (panel, command) => (command === 'GetActiveBattleMapId' ? 'bm-1' : undefined)),
    fireEvent: vi.fn(),
    on: vi.fn((name, handler) => { const wrapped = { name, handler }; events.push(wrapped); return wrapped; }),
    off: vi.fn((wrapped) => { const i = events.indexOf(wrapped); if (i >= 0) events.splice(i, 1); }),
  },
}));

import ClientMediator from '../../../ClientMediator';
import { ActiveWebHelper as WebHelper } from '../../../helpers/transport';
import { TurnOrderManager } from './TurnOrderManager';
import { getTurnOrderState } from './turnOrderStore';

const state = (round, entries = [{ id: 'e1', name: 'Hero', elementId: 't1' }]) => ({ mapId: 'map-1', round, entries });
const emit = (command, data) => act(() => ws.forEach((cb) => cb({ command, data })));
const fire = (name, data) => act(() => events.filter((e) => e.name === name).forEach((e) => e.handler(data)));

describe('TurnOrderManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ws.clear();
    events.length = 0;
    WebHelper.getAsync.mockResolvedValue(state(1));
  });

  it('registers the TurnOrder commands and loads the order of the map on screen', async () => {
    render(<TurnOrderManager />);

    expect(ClientMediator.register).toHaveBeenCalledWith(expect.objectContaining({ panel: 'TurnOrder' }));
    await waitFor(() => expect(getTurnOrderState()?.round).toBe(1));
    expect(ClientMediator.fireEvent).toHaveBeenCalledWith('TurnOrder:Changed', state(1));
  });

  it("refetches when this map's turn order changes, not another map's", async () => {
    render(<TurnOrderManager />);
    await waitFor(() => expect(WebHelper.getAsync).toHaveBeenCalledTimes(1));

    WebHelper.getAsync.mockResolvedValue(state(2));
    emit('turnorder_advance', { mapId: 'other-map', round: 5 });
    emit('turnorder_advance', { mapId: 'map-1', round: 2 });

    await waitFor(() => expect(getTurnOrderState()?.round).toBe(2));
    expect(WebHelper.getAsync).toHaveBeenCalledTimes(2);
  });

  it('refetches when a token in the order is removed, or the map or battle map view changes', async () => {
    render(<TurnOrderManager />);
    await waitFor(() => expect(WebHelper.getAsync).toHaveBeenCalledTimes(1));

    emit('element_remove', { id: 'not-in-the-order' });
    emit('element_remove', { id: 't1' });
    await waitFor(() => expect(WebHelper.getAsync).toHaveBeenCalledTimes(2));

    emit('map_change', { id: 'bm-1', mapId: 'map-1' });
    await waitFor(() => expect(WebHelper.getAsync).toHaveBeenCalledTimes(3));

    fire('ActivePanelChanged', { panel: 'BattleMap', contextId: 'bm-1' });
    await waitFor(() => expect(WebHelper.getAsync).toHaveBeenCalledTimes(4));
  });

  it('stops listening when unmounted', async () => {
    const { unmount } = render(<TurnOrderManager />);
    await waitFor(() => expect(WebHelper.getAsync).toHaveBeenCalledTimes(1));

    unmount();

    expect(ws.size).toBe(0);
    expect(events).toHaveLength(0);
    expect(ClientMediator.unregister).toHaveBeenCalled();
  });
});
