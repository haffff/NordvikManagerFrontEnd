import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// WebHelper.getResourceString is only used by getResourceString()/getMaterialAsync
// fallback paths, not touched by these tests — mock it out so importing the real
// module doesn't pull in fetch/env-dependent code.
vi.mock('./WebHelper', () => ({
  default: { getResourceString: vi.fn() },
}));

const convertBlobToB64 = vi.fn();
vi.mock('./UtilityHelper', () => ({
  default: { ConvertBlobToB64: (...args) => convertBlobToB64(...args) },
}));

vi.mock('./ResourceCache', () => ({
  default: { get: vi.fn(), put: vi.fn() },
}));

import WebRTCWebHelperInstance from './WebRTCWebHelper';
import ResourceCache from './ResourceCache';

// Regression coverage for reset() — added so a request still sitting in _queue
// (channel not open yet) or _pending (sent, awaiting response) at game-exit time
// doesn't survive into the next game session. See WebRTCManager.Close(), which
// calls this on every session end.
describe('WebRTCWebHelper.reset', () => {
  beforeEach(() => {
    WebRTCWebHelperInstance._pending = new Map();
    WebRTCWebHelperInstance._queue = [];
    WebRTCWebHelperInstance.GameId = 'game-a';
  });

  it('rejects and clears every pending (sent, awaiting response) request', async () => {
    const reject = vi.fn();
    const timeoutHandle = setTimeout(() => {}, 30000);
    WebRTCWebHelperInstance._pending.set('req-1', { resolve: vi.fn(), reject, timeoutHandle });

    WebRTCWebHelperInstance.reset();

    expect(reject).toHaveBeenCalledTimes(1);
    expect(reject.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(WebRTCWebHelperInstance._pending.size).toBe(0);
  });

  it('rejects and clears every queued (not yet sent) request', () => {
    const reject = vi.fn();
    const timeoutHandle = setTimeout(() => {}, 30000);
    WebRTCWebHelperInstance._queue.push({ message: { id: 'q-1' }, resolve: vi.fn(), reject, timeoutHandle });

    WebRTCWebHelperInstance.reset();

    expect(reject).toHaveBeenCalledTimes(1);
    expect(WebRTCWebHelperInstance._queue).toHaveLength(0);
  });

  it('clears each timeout handle so it cannot fire its own (double) rejection later', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    const timeoutHandle = setTimeout(() => {}, 30000);
    WebRTCWebHelperInstance._pending.set('req-1', { resolve: vi.fn(), reject: vi.fn(), timeoutHandle });

    WebRTCWebHelperInstance.reset();

    expect(clearSpy).toHaveBeenCalledWith(timeoutHandle);
    clearSpy.mockRestore();
  });

  it('does NOT clear GameId — Game.js/MainApp own that lifecycle, and clearing it here would drop the gameid off requests made between forceReconnect() and the next render', () => {
    WebRTCWebHelperInstance.reset();
    expect(WebRTCWebHelperInstance.GameId).toBe('game-a');
  });
});

// Regression coverage for the missing .catch() on postMaterial's promise chain —
// a FileReader failure inside ConvertBlobToB64 used to produce an unhandled
// rejection and never call onerror/onException.
describe('WebRTCWebHelper.postMaterial', () => {
  beforeEach(() => {
    convertBlobToB64.mockReset();
  });

  it('calls onException (not silently swallowed / unhandled) when ConvertBlobToB64 rejects', async () => {
    const error = new Error('FileReader failed');
    convertBlobToB64.mockRejectedValue(error);
    const onException = vi.fn();

    WebRTCWebHelperInstance.postMaterial({ name: 'a.png', type: 'image/png' }, vi.fn(), vi.fn(), onException);

    // Let the rejected promise's .catch() run
    await new Promise((r) => setTimeout(r, 0));

    expect(onException).toHaveBeenCalledWith(error);
  });

  it('falls back to console.error when no onException handler is given', async () => {
    const error = new Error('FileReader failed');
    convertBlobToB64.mockRejectedValue(error);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    WebRTCWebHelperInstance.postMaterial({ name: 'a.png', type: 'image/png' }, vi.fn(), vi.fn());
    await new Promise((r) => setTimeout(r, 0));

    expect(consoleSpy).toHaveBeenCalledWith(error);
    consoleSpy.mockRestore();
  });
});

// Uploads are now fed into the data channel as it drains, so sending a big
// request can take a while: the response timeout starts once it's all sent.
describe('WebRTCWebHelper sending', () => {
  let finishSend;
  let failSend;
  let transport;

  beforeEach(() => {
    vi.useFakeTimers();
    WebRTCWebHelperInstance._pending = new Map();
    WebRTCWebHelperInstance._queue = [];
    transport = {
      isChannelReady: () => true,
      sendRaw: vi.fn((message, opts) => new Promise((resolve, reject) => {
        transport.lastOpts = opts;
        finishSend = resolve;
        failSend = reject;
      })),
    };
    WebRTCWebHelperInstance._transport = transport;
  });

  afterEach(() => {
    vi.useRealTimers();
    WebRTCWebHelperInstance._transport = null;
  });

  it('a slow send does not time out; the wait for the response does', async () => {
    const result = WebRTCWebHelperInstance.postAsync('materials/addresource', { data: 'x' });
    let error;
    result.catch((e) => { error = e; });

    await vi.advanceTimersByTimeAsync(5 * 60_000); // still sending after 5 minutes
    expect(error).toBeUndefined();

    finishSend();
    await vi.advanceTimersByTimeAsync(31_000);
    expect(error?.message).toMatch(/timeout/i);
  });

  it('a failed send rejects the request and forgets it', async () => {
    const result = WebRTCWebHelperInstance.postAsync('materials/addresource', { data: 'x' });

    failSend(new Error('Data channel closed'));

    await expect(result).rejects.toThrow('Data channel closed');
    expect(WebRTCWebHelperInstance._pending.size).toBe(0);
  });

  it('postMaterial reports upload progress as a fraction', async () => {
    convertBlobToB64.mockResolvedValue('b64');
    const onProgress = vi.fn();

    WebRTCWebHelperInstance.postMaterial({ name: 'a.png', type: 'image/png' }, vi.fn(), vi.fn(), vi.fn(), onProgress);
    await vi.advanceTimersByTimeAsync(0);
    transport.lastOpts.onProgress(250, 1000);

    expect(onProgress).toHaveBeenCalledWith(0.25);
  });
});

// Resources are kept in the browser (ResourceCache) with the server's version, and
// only downloaded again when the server says the version changed.
describe('WebRTCWebHelper.getMaterialAsync caching', () => {
  const b64 = (text) => btoa(text);
  const bytesOf = (text) => Uint8Array.from(text, (c) => c.charCodeAt(0)).buffer;
  // jsdom's Blob has no .text()
  const readText = (blob) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsText(blob);
  });
  let send;

  beforeEach(() => {
    vi.clearAllMocks();
    WebRTCWebHelperInstance.GameId = 'game-1';
    ResourceCache.get.mockResolvedValue(null);
    ResourceCache.put.mockResolvedValue(true);
    send = vi.spyOn(WebRTCWebHelperInstance, '_sendRequest');
  });

  afterEach(() => send.mockRestore());

  it('not cached: plain request, result stored with its version', async () => {
    send.mockResolvedValue({ status: 200, body: { data: b64('music'), mimeType: 'audio/mpeg', version: 'v1' } });

    const blob = await WebRTCWebHelperInstance.getMaterialAsync('r1');

    expect(send.mock.calls[0][1]).toBe('materials/resource?id=r1');
    expect(blob).toBeInstanceOf(Blob);
    expect(await readText(blob)).toBe('music');
    const [key, stored] = ResourceCache.put.mock.calls[0];
    expect(key).toBe('game-1:r1');
    expect(stored.version).toBe('v1');
    expect(stored.mimeType).toBe('audio/mpeg');
    expect(new Uint8Array(stored.data)).toEqual(new Uint8Array(bytesOf('music')));
  });

  it('cached and unchanged: asks with its version and uses the cached bytes', async () => {
    ResourceCache.get.mockResolvedValue({ data: bytesOf('music'), mimeType: 'audio/mpeg', version: 'v1' });
    send.mockResolvedValue({ status: 200, body: { notModified: true, version: 'v1' } });

    const blob = await WebRTCWebHelperInstance.getMaterialAsync('r1');

    expect(send.mock.calls[0][1]).toBe('materials/resource?id=r1&ifVersion=v1');
    expect(blob.type).toBe('audio/mpeg');
    expect(await readText(blob)).toBe('music');
    expect(ResourceCache.put).not.toHaveBeenCalled();
  });

  it('cached but changed on the server: new bytes returned and stored', async () => {
    ResourceCache.get.mockResolvedValue({ data: bytesOf('old'), mimeType: 'audio/mpeg', version: 'v1' });
    send.mockResolvedValue({ status: 200, body: { data: b64('new'), mimeType: 'audio/mpeg', version: 'v2' } });

    const blob = await WebRTCWebHelperInstance.getMaterialAsync('r1');

    expect(await readText(blob)).toBe('new');
    expect(ResourceCache.put.mock.calls[0][1].version).toBe('v2');
  });

  it('text types come back as the same string as before caching, also from the cache', async () => {
    ResourceCache.get.mockResolvedValue({ data: bytesOf('body{}'), mimeType: 'text/css', version: 'v1' });
    send.mockResolvedValue({ status: 200, body: { notModified: true, version: 'v1' } });

    expect(await WebRTCWebHelperInstance.getMaterialAsync(null, 'application/octet-stream', 'style.css')).toBeInstanceOf(Blob);
    expect(await WebRTCWebHelperInstance.getMaterialAsync('r2', 'text/plain')).toBe('body{}');
  });

  it('thumbnails and key lookups have their own cache keys', async () => {
    send.mockResolvedValue({ status: 200, body: { data: b64('x'), mimeType: 'image/png', version: 't-v1' } });

    await WebRTCWebHelperInstance.getMaterialAsync('r1', null, null, true);
    await WebRTCWebHelperInstance.getMaterialAsync(null, null, 'emptyImage');

    expect(ResourceCache.get.mock.calls.map(([k]) => k)).toEqual(['game-1:t:r1', 'game-1:emptyImage']);
  });

  it('a failed request still returns undefined', async () => {
    send.mockResolvedValue({ status: 404, body: null });

    expect(await WebRTCWebHelperInstance.getMaterialAsync('r1')).toBeUndefined();
    expect(ResourceCache.put).not.toHaveBeenCalled();
  });
});
