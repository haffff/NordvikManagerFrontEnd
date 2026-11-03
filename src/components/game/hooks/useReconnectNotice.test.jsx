import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { subscribers, toasterMock, reloadMock } = vi.hoisted(() => ({
  subscribers: new Map(),
  toasterMock: { create: vi.fn() },
  reloadMock: vi.fn(),
}));

vi.mock('../../../helpers/transport', () => ({
  ActiveTransportManager: {
    Subscribe: (name, fn) => subscribers.set(name, fn),
    Unsubscribe: (name) => subscribers.delete(name),
  },
}));
vi.mock('../../ui/toaster', () => ({ toaster: toasterMock }));

import { useReconnectNotice } from './useReconnectNotice';

const broadcast = (message) => [...subscribers.values()].forEach((fn) => fn(message));

// After the connection to the game drops and comes back, pushes sent in between are lost.
// Until panels can catch up on their own, the player is told and offered a reload.
describe('useReconnectNotice', () => {
  beforeEach(() => {
    subscribers.clear();
    vi.clearAllMocks();
  });

  it('offers a reload when the channel is back after a drop', () => {
    renderHook(() => useReconnectNotice({ reload: reloadMock }));

    broadcast({ command: '__channel_ready__', reconnected: true });

    expect(toasterMock.create).toHaveBeenCalledTimes(1);
    const toast = toasterMock.create.mock.calls[0][0];
    expect(toast.description).toMatch(/may be missing/i);
    toast.action.onClick();
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('shows one notice, however often it reconnects', () => {
    renderHook(() => useReconnectNotice({ reload: reloadMock }));

    broadcast({ command: '__channel_ready__', reconnected: true });
    broadcast({ command: '__channel_ready__', reconnected: true });

    const ids = toasterMock.create.mock.calls.map(([t]) => t.id);
    expect(new Set(ids).size).toBe(1);
  });

  it('says nothing on the first connect or for other messages', () => {
    renderHook(() => useReconnectNotice({ reload: reloadMock }));

    broadcast({ command: '__channel_ready__', reconnected: false });
    broadcast({ command: 'chat_add' });

    expect(toasterMock.create).not.toHaveBeenCalled();
  });

  it('reports every open, so a connection error shown earlier can be cleared', () => {
    const onChannelReady = vi.fn();
    renderHook(() => useReconnectNotice({ reload: reloadMock, onChannelReady }));

    broadcast({ command: '__channel_ready__', reconnected: false });
    broadcast({ command: '__channel_ready__', reconnected: true });

    expect(onChannelReady).toHaveBeenCalledTimes(2);
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useReconnectNotice({ reload: reloadMock }));
    unmount();
    expect(subscribers.size).toBe(0);
  });
});
