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

import WebRTCWebHelperInstance from './WebRTCWebHelper';

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
