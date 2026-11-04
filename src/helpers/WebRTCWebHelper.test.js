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

  // A big response arrives in many chunks: while they come, the request isn't given up on.
  it('waits as long as the response keeps arriving, and 30 s after it stops', async () => {
    const result = WebRTCWebHelperInstance.getAsync('materials/resource?id=r1');
    let error;
    result.catch((e) => { error = e; });
    finishSend();
    await vi.advanceTimersByTimeAsync(0);

    for (let i = 0; i < 6; i++) {
      await vi.advanceTimersByTimeAsync(25_000);
      WebRTCWebHelperInstance.responseProgress();
    }
    expect(error).toBeUndefined(); // 150 s in, still coming

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
// only downloaded again when the server says the version changed. They come in pieces
// (materials/resourcerange): other messages get through in between, and a big file
// shows progress.
describe('WebRTCWebHelper.getMaterialAsync', () => {
  const bytesOf = (text) => Uint8Array.from(text, (c) => c.charCodeAt(0)).buffer;
  const readText = (blob) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsText(blob);
  });
  let send;
  let files; // id or key → { text, mimeType, version }
  let failures; // start → how many times that piece fails first
  let hasRangeRoute;

  // A fake GM backend: materials/resourcerange and materials/resource (whole file, thumbnails).
  const answer = async (method, path) => {
    const url = new URL('http://x/' + path);
    const ref = url.searchParams.get('id') || url.searchParams.get('key');
    const file = files[ref];
    const ifVersion = url.searchParams.get('ifVersion');
    if (url.pathname === '/materials/resourcerange') {
      if (!hasRangeRoute || !file) return { status: 404, body: null };
      const start = Number(url.searchParams.get('start'));
      if ((failures[start] ?? 0) > 0) { failures[start]--; throw new Error('WebRTC API timeout'); }
      if (ifVersion === file.version) return { status: 200, body: { notModified: true, start, total: file.text.length, version: file.version } };
      const part = file.text.slice(start, start + Number(url.searchParams.get('length')));
      return { status: 200, body: { data: btoa(part), start, total: file.text.length, mimeType: file.mimeType, version: file.version } };
    }
    if (!file) return { status: 404, body: null };
    if (ifVersion === file.version) return { status: 200, body: { notModified: true, version: file.version } };
    return { status: 200, body: { data: btoa(file.text), mimeType: file.mimeType, version: file.version } };
  };
  const paths = () => send.mock.calls.map((c) => c[1]);

  beforeEach(() => {
    vi.clearAllMocks();
    WebRTCWebHelperInstance.GameId = 'game-1';
    WebRTCWebHelperInstance.pieceSize = 4;
    files = { r1: { text: 'music', mimeType: 'audio/mpeg', version: 'v1' } };
    failures = {};
    hasRangeRoute = true;
    ResourceCache.get.mockResolvedValue(null);
    ResourceCache.put.mockResolvedValue(true);
    send = vi.spyOn(WebRTCWebHelperInstance, '_sendRequest').mockImplementation(answer);
  });

  afterEach(() => { send.mockRestore(); delete WebRTCWebHelperInstance.pieceSize; });

  it('fetches the file in pieces, assembles it and stores it whole with its version', async () => {
    files.r1.text = 'abcdefghij';
    const progress = vi.fn();

    const blob = await WebRTCWebHelperInstance.getMaterialAsync('r1', null, null, false, { onProgress: progress });

    expect(paths()).toEqual([
      'materials/resourcerange?id=r1&start=0&length=4',
      'materials/resourcerange?id=r1&start=4&length=4',
      'materials/resourcerange?id=r1&start=8&length=4',
    ]);
    expect(await readText(blob)).toBe('abcdefghij');
    expect(blob.type).toBe('audio/mpeg');
    const [key, stored] = ResourceCache.put.mock.calls[0];
    expect(key).toBe('game-1:r1');
    expect(stored.version).toBe('v1');
    expect(new Uint8Array(stored.data)).toEqual(new Uint8Array(bytesOf('abcdefghij')));
    expect(progress.mock.calls.map(([f]) => f)).toEqual([0.4, 0.8, 1]);
  });

  it('a small file is one request', async () => {
    files.r1.text = 'abc';
    expect(await readText(await WebRTCWebHelperInstance.getMaterialAsync('r1'))).toBe('abc');
    expect(paths()).toEqual(['materials/resourcerange?id=r1&start=0&length=4']);
  });

  it('cached and unchanged: asks with its version and uses the cached bytes', async () => {
    ResourceCache.get.mockResolvedValue({ data: bytesOf('music'), mimeType: 'audio/mpeg', version: 'v1' });

    const blob = await WebRTCWebHelperInstance.getMaterialAsync('r1');

    expect(paths()).toEqual(['materials/resourcerange?id=r1&start=0&length=4&ifVersion=v1']);
    expect(blob.type).toBe('audio/mpeg');
    expect(await readText(blob)).toBe('music');
    expect(ResourceCache.put).not.toHaveBeenCalled();
  });

  it('cached but changed on the server: new bytes returned and stored', async () => {
    ResourceCache.get.mockResolvedValue({ data: bytesOf('old'), mimeType: 'audio/mpeg', version: 'v0' });
    files.r1.text = 'new';

    expect(await readText(await WebRTCWebHelperInstance.getMaterialAsync('r1'))).toBe('new');
    expect(ResourceCache.put.mock.calls[0][1].version).toBe('v1');
  });

  it('a piece that fails is asked for again; one that keeps failing fails the download', async () => {
    files.r1.text = 'abcdefghij';
    failures[4] = 1;
    expect(await readText(await WebRTCWebHelperInstance.getMaterialAsync('r1'))).toBe('abcdefghij');

    failures[8] = 5;
    ResourceCache.put.mockClear();
    expect(await WebRTCWebHelperInstance.getMaterialAsync('r1')).toBeUndefined();
    expect(ResourceCache.put).not.toHaveBeenCalled();
  });

  it('the file changing during the download: fetched again whole', async () => {
    files.r1.text = 'abcdefghij';
    let calls = 0;
    send.mockImplementation(async (m, p) => {
      calls++;
      if (calls === 2) files.r1 = { text: 'ABCDEFGHIJ', mimeType: 'audio/mpeg', version: 'v2' };
      return answer(m, p);
    });

    expect(await readText(await WebRTCWebHelperInstance.getMaterialAsync('r1'))).toBe('ABCDEFGHIJ');
    expect(paths().at(-1)).toBe('materials/resource?id=r1');
  });

  it('an older server without ranges: the whole file, as before', async () => {
    hasRangeRoute = false;

    expect(await readText(await WebRTCWebHelperInstance.getMaterialAsync('r1'))).toBe('music');
    expect(paths()).toEqual(['materials/resourcerange?id=r1&start=0&length=4', 'materials/resource?id=r1']);
  });

  it('text types come back as strings; thumbnails and key lookups keep their routes and cache keys', async () => {
    files['style.css'] = { text: 'body{}', mimeType: 'text/css', version: 'v1' };
    files.r2 = { text: 'body{}', mimeType: 'text/plain', version: 'v1' };

    expect(await WebRTCWebHelperInstance.getMaterialAsync(null, 'application/octet-stream', 'style.css')).toBeInstanceOf(Blob);
    expect(await WebRTCWebHelperInstance.getMaterialAsync('r2', 'text/plain')).toBe('body{}');
    await WebRTCWebHelperInstance.getMaterialAsync('r1', null, null, true);

    expect(paths()).toContain('materials/resourcerange?key=style.css&start=0&length=4');
    expect(paths()).toContain('materials/resource?id=r1&thumbnail=true');
    expect(ResourceCache.get.mock.calls.map(([k]) => k)).toEqual(['game-1:style.css', 'game-1:r2', 'game-1:t:r1']);
  });

  it('a missing file still returns undefined', async () => {
    expect(await WebRTCWebHelperInstance.getMaterialAsync('gone')).toBeUndefined();
    expect(ResourceCache.put).not.toHaveBeenCalled();
  });
});

// A request queued while the channel was closed that times out has already been
// reported as failed; sending it once the channel opens would run it anyway, and a
// retried POST would then run twice.
describe('WebRTCWebHelper queued request timeout', () => {
  let transport;
  beforeEach(() => {
    vi.useFakeTimers();
    WebRTCWebHelperInstance._pending = new Map();
    WebRTCWebHelperInstance._queue = [];
    transport = { ready: false, isChannelReady: () => transport.ready, sendRaw: vi.fn(() => Promise.resolve()) };
    WebRTCWebHelperInstance.setTransport(transport);
  });
  afterEach(() => {
    vi.useRealTimers();
    WebRTCWebHelperInstance.setTransport(null);
  });

  it('is never sent after it timed out', async () => {
    const request = WebRTCWebHelperInstance.postAsync('elements/add', { a: 1 });
    const outcome = request.then(() => 'sent', (e) => e.message);

    await vi.advanceTimersByTimeAsync(31_000);
    transport.ready = true;
    WebRTCWebHelperInstance.flushQueue();

    expect(transport.sendRaw).not.toHaveBeenCalled();
    expect(WebRTCWebHelperInstance._queue).toHaveLength(0);
    expect(await outcome).toMatch(/timeout/);
  });

  it('is still sent when the channel opens in time', async () => {
    WebRTCWebHelperInstance.postAsync('elements/add', { a: 1 });

    await vi.advanceTimersByTimeAsync(5_000);
    transport.ready = true;
    WebRTCWebHelperInstance.flushQueue();

    expect(transport.sendRaw).toHaveBeenCalledTimes(1);
  });
});
