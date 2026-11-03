import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { subscribers } = vi.hoisted(() => ({ subscribers: new Map() }));

vi.mock('./transport', () => ({
  ActiveTransportManager: {
    Subscribe: (name, fn) => subscribers.set(name, fn),
    Unsubscribe: (name) => subscribers.delete(name),
  },
}));

import { onResync, useResync, useResyncKey } from './resync';

const broadcast = (message) => [...subscribers.values()].forEach((fn) => fn(message));
const reconnected = () => broadcast({ command: '__channel_ready__', reconnected: true });

// Pushes sent while the connection was down never arrive, so whatever a view loaded is out
// of date once it's back: it loads again.
describe('resync', () => {
  beforeEach(() => subscribers.clear());

  it('runs after the channel is back from a drop, not on the first open or other messages', () => {
    const load = vi.fn();
    onResync(load);

    broadcast({ command: '__channel_ready__', reconnected: false });
    broadcast({ command: 'chat_add' });
    expect(load).not.toHaveBeenCalled();

    reconnected();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('stops once unsubscribed', () => {
    const load = vi.fn();
    const stop = onResync(load);
    stop();

    reconnected();
    expect(load).not.toHaveBeenCalled();
  });

  it('keeps each subscriber separate', () => {
    const a = vi.fn();
    const b = vi.fn();
    onResync(a);
    onResync(b);

    reconnected();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('one failing loader does not stop the others', () => {
    const ok = vi.fn();
    onResync(() => { throw new Error('boom'); });
    onResync(ok);

    expect(() => reconnected()).not.toThrow();
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('useResync calls the latest callback and unsubscribes on unmount', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(({ fn }) => useResync(fn), { initialProps: { fn: first } });
    rerender({ fn: second });

    reconnected();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    unmount();
    expect(subscribers.size).toBe(0);
  });

  it('useResyncKey changes on each reconnect, so effects that depend on it run again', () => {
    const { result } = renderHook(() => useResyncKey());
    const first = result.current;

    act(() => broadcast({ command: '__channel_ready__', reconnected: false }));
    expect(result.current).toBe(first);

    act(() => reconnected());
    const second = result.current;
    expect(second).not.toBe(first);

    act(() => reconnected());
    expect(result.current).not.toBe(second);
  });
});
