import { vi, describe, it, expect, afterEach } from 'vitest';
import { PROTOCOL_VERSION, clientPathForProtocol, clientExistsForProtocol, isServedFrom } from './protocol';
import protocolJson from '../protocol.json';

describe('protocol helper', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('PROTOCOL_VERSION comes from protocol.json (CI compares that file with the backend)', () => {
    expect(PROTOCOL_VERSION).toBe(protocolJson.protocol);
    expect(Number.isInteger(PROTOCOL_VERSION)).toBe(true);
  });

  it('isServedFrom tells whether this page is under a folder', () => {
    window.history.pushState({}, '', '/client/p2/?game=x');
    expect(isServedFrom('/client/p2/')).toBe(true);
    expect(isServedFrom('/client/p3/')).toBe(false);
    window.history.pushState({}, '', '/');
  });

  it('clientPathForProtocol points at the frozen build folder for that protocol', () => {
    expect(clientPathForProtocol(3)).toBe('/client/p3/');
  });

  it('clientExistsForProtocol asks for the folder index.html with HEAD and reports ok', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(clientExistsForProtocol(2)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/client/p2/index.html', expect.objectContaining({ method: 'HEAD' }));
  });

  const noWait = { sleep: () => Promise.resolve() };
  const answer = (status, retryAfter = null) => ({ ok: status < 300, status, headers: { get: (h) => (h.toLowerCase() === 'retry-after' ? retryAfter : null) } });

  it('clientExistsForProtocol is false on 404, and after network failures', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(answer(404))));
    await expect(clientExistsForProtocol(2, noWait)).resolves.toBe(false);

    const offline = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', offline);
    await expect(clientExistsForProtocol(2, noWait)).resolves.toBe(false);
    expect(offline).toHaveBeenCalledTimes(3);
  });

  // The host rate-limits (429) bursts of requests: that says nothing about the folder.
  it('clientExistsForProtocol waits out a 429 and asks again', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(answer(429, '4'))
      .mockResolvedValueOnce(answer(200));
    vi.stubGlobal('fetch', fetchMock);
    const sleep = vi.fn(() => Promise.resolve());

    await expect(clientExistsForProtocol(2, { sleep })).resolves.toBe(true);
    expect(sleep).toHaveBeenCalledWith(4000);
  });

  it('clientExistsForProtocol takes a folder the server keeps refusing to talk about as there', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(answer(429, '300'))));
    const sleep = vi.fn(() => Promise.resolve());

    await expect(clientExistsForProtocol(2, { sleep })).resolves.toBe(true);
    // Never more than 10 s at a time.
    expect(Math.max(...sleep.mock.calls.map(([ms]) => ms))).toBe(10000);
  });
});
