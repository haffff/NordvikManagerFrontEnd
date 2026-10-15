import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import CentralWebHelper, { refreshAccessToken } from './CentralWebHelper';
import TokenStore from './TokenStore';

describe('CentralWebHelper.getAsync', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn(() => Promise.resolve(new Response('{"ok":true}', { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('relies on the cookie when no access token is given', async () => {
    await CentralWebHelper.getAsync('meta');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('sends the access token as a Bearer header when given', async () => {
    const result = await CentralWebHelper.getAsync('ice-servers', 'token-1');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-1');
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
    expect(result).toEqual({ ok: true });
  });
});

// The refresh token is an httpOnly cookie (refreshMode "cookie"). Central rotates it on
// every refresh, so parallel refreshes would invalidate each other — they're merged
// into one, and serialized across tabs with a Web Lock.
describe('CentralWebHelper token refresh', () => {
  let fetchMock;
  const urlOf = (call) => String(call[0]);
  const refreshCalls = () => fetchMock.mock.calls.filter((c) => urlOf(c).endsWith('/user/refresh'));

  // Answers /user/refresh with `refresh`; other requests 401 until a refresh succeeded.
  function serve(refresh) {
    let refreshed = false;
    fetchMock = vi.fn(async (url) => {
      if (String(url).endsWith('/user/refresh')) {
        const res = await refresh();
        if (res.ok) refreshed = true;
        return res;
      }
      return refreshed ? new Response('{"ok":true}', { status: 200 }) : new Response('', { status: 401 });
    });
    vi.stubGlobal('fetch', fetchMock);
  }

  beforeEach(() => {
    TokenStore.setAccessToken('old');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('merges parallel 401s into one refresh, then retries each request', async () => {
    serve(() => new Response('{"accessToken":"new"}', { status: 200 }));

    const [a, b] = await Promise.all([CentralWebHelper.getAsync('a'), CentralWebHelper.getAsync('b')]);

    expect(refreshCalls()).toHaveLength(1);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(TokenStore.getAccessToken()).toBe('new');
  });

  it('asks for cookie mode and sends no token of its own', async () => {
    serve(() => new Response('{"accessToken":"new"}', { status: 200 }));

    await refreshAccessToken();

    const [, init] = refreshCalls()[0];
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body)).toEqual({ refreshMode: 'cookie' });
  });

  it('keeps the session when Central fails for another reason (5xx, 429, network)', async () => {
    const clear = vi.spyOn(TokenStore, 'clear');
    for (const respond of [() => new Response('', { status: 500 }), () => new Response('', { status: 429 }), () => Promise.reject(new Error('offline'))]) {
      serve(respond);
      expect(await refreshAccessToken()).toBe(false);
    }
    expect(clear).not.toHaveBeenCalled();
  });

  it('ends the session when Central rejects the refresh token', async () => {
    const clear = vi.spyOn(TokenStore, 'clear');
    serve(() => new Response('', { status: 401 }));

    expect(await refreshAccessToken()).toBe(false);
    expect(clear).toHaveBeenCalled();
  });

  it('holds a Web Lock while refreshing, so tabs take turns', async () => {
    const request = vi.fn((name, fn) => fn());
    vi.stubGlobal('navigator', { ...navigator, locks: { request } });
    serve(() => new Response('{"accessToken":"new"}', { status: 200 }));

    await refreshAccessToken();

    expect(request).toHaveBeenCalledWith('nm-central-refresh', expect.any(Function));
  });
});
