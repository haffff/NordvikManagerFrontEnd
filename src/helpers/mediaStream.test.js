import { describe, it, expect, vi, beforeEach } from 'vitest';

const { readRangeMock } = vi.hoisted(() => ({ readRangeMock: vi.fn() }));
vi.mock('./rangeRead', () => ({ readRange: readRangeMock }));

import { startMediaStreaming, streamUrl, _resetForTests } from './mediaStream';

// The page's side of media streaming: it registers public/stream-sw.js for its own build's
// scope, answers the worker's part requests over the game connection, and hands out
// __stream URLs once a worker controls the page.
function fakeNavigator({ controller = null } = {}) {
  const listeners = {};
  return {
    listeners,
    serviceWorker: {
      controller,
      register: vi.fn(async () => ({})),
      addEventListener: (type, fn) => { listeners[type] = fn; },
    },
  };
}

describe('mediaStream', () => {
  beforeEach(() => { _resetForTests(); readRangeMock.mockReset(); });

  it('registers the worker for its own build, and only where service workers work', () => {
    const nav = fakeNavigator();
    expect(startMediaStreaming({ navigator: nav, secure: true })).toBe(true);
    expect(nav.serviceWorker.register).toHaveBeenCalledWith('./stream-sw.js', { scope: './' });

    _resetForTests();
    expect(startMediaStreaming({ navigator: fakeNavigator(), secure: false })).toBe(false);
    expect(startMediaStreaming({ navigator: {}, secure: true })).toBe(false);
  });

  it("answers the worker's part requests with a copy of the bytes", async () => {
    const nav = fakeNavigator();
    startMediaStreaming({ navigator: nav, secure: true });
    const bytes = new Uint8Array([1, 2, 3]);
    readRangeMock.mockResolvedValue({ bytes, start: 0, total: 3, mimeType: 'audio/mpeg', version: 'v' });
    const port = { postMessage: vi.fn() };

    await nav.listeners.message({ data: { type: 'nm-stream-read', ref: { id: 'r1' }, start: 0, length: 2097152 }, ports: [port] });

    expect(readRangeMock).toHaveBeenCalledWith({ id: 'r1' }, 0, 2097152);
    const [reply, transfer] = port.postMessage.mock.calls[0];
    expect(reply).toMatchObject({ total: 3, mimeType: 'audio/mpeg' });
    expect([...new Uint8Array(reply.bytes)]).toEqual([1, 2, 3]);
    expect(transfer).toEqual([reply.bytes]);
    expect(reply.bytes).not.toBe(bytes.buffer); // the original may still be on its way into the cache
  });

  it('answers with an error when the part is missing or the read fails, and ignores other messages', async () => {
    const nav = fakeNavigator();
    startMediaStreaming({ navigator: nav, secure: true });
    const port = { postMessage: vi.fn() };

    readRangeMock.mockResolvedValueOnce(null);
    await nav.listeners.message({ data: { type: 'nm-stream-read', ref: { id: 'gone' }, start: 0, length: 10 }, ports: [port] });
    readRangeMock.mockRejectedValueOnce(new Error('WebRTC API timeout'));
    await nav.listeners.message({ data: { type: 'nm-stream-read', ref: { id: 'r1' }, start: 0, length: 10 }, ports: [port] });
    await nav.listeners.message({ data: { type: 'something-else' }, ports: [port] });

    expect(port.postMessage.mock.calls.map(([m]) => Boolean(m.error))).toEqual([true, true]);
  });

  it('gives a stream URL next to the app only while a worker controls the page', () => {
    expect(streamUrl('r1', { navigator: fakeNavigator(), baseURI: 'https://nordvik.test/client/p2/' })).toBeNull();
    expect(streamUrl('r 1', { navigator: fakeNavigator({ controller: {} }), baseURI: 'https://nordvik.test/client/p2/' }))
      .toBe('https://nordvik.test/client/p2/__stream/id/r%201');
    expect(streamUrl(null, { navigator: fakeNavigator({ controller: {} }), baseURI: 'https://x/' })).toBeNull();
  });
});
