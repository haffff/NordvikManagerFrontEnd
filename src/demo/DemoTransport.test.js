import { describe, it, expect, vi, beforeEach } from 'vitest';
import WebRTCWebHelper from '../helpers/WebRTCWebHelper';
import { DemoTransport } from './DemoTransport';

const fixture = {
  version: 1,
  role: 'gm',
  requests: { 'GET api/battlemap/getplayer': { status: 200, body: { Id: 'p1', Name: 'GM' } } },
  after: { player_list: [{ command: 'player_list', data: [{ id: 'p1' }], result: 'Ok' }] },
};

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('DemoTransport', () => {
  let transport;

  beforeEach(() => {
    WebRTCWebHelper.reset();
    transport = new DemoTransport();
    transport.load(fixture);
  });

  it('starts at once and becomes the REST helper\'s transport, flushing queued requests', async () => {
    const early = WebRTCWebHelper.getAsync('battlemap/getplayer'); // queued: nothing connected yet
    transport.Start('demo', vi.fn());
    expect(transport.WebSocketStarted).toBe(true);
    expect(transport.isConnected()).toBe(true);
    expect(transport.getConnectionState()).toBe('READY');
    // Answers go through the helper's normal path, which camelizes keys.
    await expect(early).resolves.toEqual({ id: 'p1', name: 'GM' });
  });

  it('answers commands with broadcasts to every subscriber, asynchronously', async () => {
    transport.Start('demo', vi.fn());
    const a = vi.fn();
    const b = vi.fn();
    transport.Subscribe('a', a);
    transport.Subscribe('b', b);
    expect(transport.Send({ command: 'player_list' })).toBe(true);
    expect(a).not.toHaveBeenCalled();
    await flush();
    expect(a).toHaveBeenCalledWith({ command: 'player_list', data: [{ id: 'p1' }], result: 'Ok' });
    expect(b).toHaveBeenCalledTimes(1);

    transport.Unsubscribe('a');
    transport.Send({ command: 'player_list' });
    await flush();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('resubscribing under the same name replaces the handler, like WebRTCManager', async () => {
    transport.Start('demo', vi.fn());
    const first = vi.fn();
    const second = vi.fn();
    transport.Subscribe('x', first);
    transport.Subscribe('x', second);
    transport.Send({ command: 'player_list' });
    await flush();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(transport.getSubscriberCount()).toBe(1);
  });

  it('Close stops it and resets the REST helper; load() swaps the data', async () => {
    transport.Start('demo', vi.fn());
    transport.Close();
    expect(transport.WebSocketStarted).toBe(false);
    expect(transport.getConnectionState()).toBe('DISCONNECTED');

    transport.load({ ...fixture, requests: { 'GET api/battlemap/getplayer': { status: 200, body: { Id: 'p2' } } } });
    transport.Start('demo', vi.fn());
    await expect(WebRTCWebHelper.getAsync('battlemap/getplayer')).resolves.toEqual({ id: 'p2' });
  });

  it('passes notes on', async () => {
    const onNote = vi.fn();
    transport.load(fixture, { onNote });
    transport.Start('demo', vi.fn());
    await WebRTCWebHelper.getAsync('addon/repository').catch(() => {});
    expect(onNote).toHaveBeenCalledWith(expect.stringMatching(/not available in the demo/i), { quiet: true });
  });
});
