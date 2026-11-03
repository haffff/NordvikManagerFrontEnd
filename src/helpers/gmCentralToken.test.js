import { vi, describe, it, expect, afterEach } from 'vitest';
import TokenStore from './TokenStore';
import { refreshCentralTokenViaBackend } from './gmCentralToken';

// The GM app has no Central cookie: its Central access token comes from the GM backend,
// which refreshes it with the refresh token it keeps.
describe('refreshCentralTokenViaBackend', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    TokenStore.setAccessToken(null);
  });

  const serve = (respond) => {
    const fetchMock = vi.fn(respond);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('stores the access token the backend returns', async () => {
    const fetchMock = serve(async () => new Response('{"refreshed":true,"accessToken":"fresh"}', { status: 200 }));

    expect(await refreshCentralTokenViaBackend()).toBe(true);

    expect(TokenStore.getAccessToken()).toBe('fresh');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/user\/refresh-central$/);
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
  });

  it('is false when the backend says to log in again', async () => {
    serve(async () => new Response('{}', { status: 401 }));
    expect(await refreshCentralTokenViaBackend()).toBe(false);
  });

  it('is null when it could not ask (5xx, network, no token in the answer)', async () => {
    for (const respond of [
      async () => new Response('', { status: 502 }),
      async () => { throw new Error('offline'); },
      async () => new Response('{"refreshed":true}', { status: 200 }),
    ]) {
      serve(respond);
      expect(await refreshCentralTokenViaBackend()).toBeNull();
    }
  });
});
