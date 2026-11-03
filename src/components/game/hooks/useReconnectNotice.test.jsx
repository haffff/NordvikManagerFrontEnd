import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { subscribers, toasterMock } = vi.hoisted(() => ({
  subscribers: new Map(),
  toasterMock: { create: vi.fn() },
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

// The game's views catch up on their own after a dropped connection (helpers/resync.js), so
// the player is only told, briefly, that the connection was back — no reload needed.
describe('useReconnectNotice', () => {
  beforeEach(() => {
    subscribers.clear();
    vi.clearAllMocks();
  });

  it('says briefly that the game is back and caught up, without offering a reload', () => {
    renderHook(() => useReconnectNotice());

    broadcast({ command: '__channel_ready__', reconnected: true });

    expect(toasterMock.create).toHaveBeenCalledTimes(1);
    const toast = toasterMock.create.mock.calls[0][0];
    expect(toast.title).toMatch(/reconnected/i);
    expect(toast.description).toMatch(/caught up/i);
    expect(toast.type).toBe('info');
    expect(Number.isFinite(toast.duration)).toBe(true);
    expect(toast.action).toBeUndefined();
  });

  it('shows one notice at a time, however often it reconnects', () => {
    renderHook(() => useReconnectNotice());

    broadcast({ command: '__channel_ready__', reconnected: true });
    broadcast({ command: '__channel_ready__', reconnected: true });

    const ids = toasterMock.create.mock.calls.map(([t]) => t.id);
    expect(new Set(ids).size).toBe(1);
  });

  it('says nothing on the first connect or for other messages', () => {
    renderHook(() => useReconnectNotice());

    broadcast({ command: '__channel_ready__', reconnected: false });
    broadcast({ command: 'chat_add' });

    expect(toasterMock.create).not.toHaveBeenCalled();
  });

  it('reports every open, so a connection error shown earlier can be cleared', () => {
    const onChannelReady = vi.fn();
    renderHook(() => useReconnectNotice({ onChannelReady }));

    broadcast({ command: '__channel_ready__', reconnected: false });
    broadcast({ command: '__channel_ready__', reconnected: true });

    expect(onChannelReady).toHaveBeenCalledTimes(2);
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useReconnectNotice());
    unmount();
    expect(subscribers.size).toBe(0);
  });
});
