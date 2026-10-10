import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import CentralWebHelper from './CentralWebHelper';

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
