import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hostFetch, HOST_API } from './hostFetch';

// The host build's GM backend is the browser host in this tab (HostPage's exports over the page
// bridge): hostFetch answers the GM app's fetch()es to HOST_API from it.
const fakeHost = (answers = {}) => {
  const calls = [];
  return {
    calls,
    Login: vi.fn(async (user, password) => user === 'gm' && password === 'secret'),
    Logout: vi.fn(async () => {}),
    UserName: vi.fn(async () => 'gm'),
    Call: vi.fn(async (method, path, body) => {
      calls.push({ method, path, body: body === null ? null : JSON.parse(body) });
      const answer = answers[`${method} ${path.split('?')[0]}`] ?? { status: 200, body: { ok: true } };
      return JSON.stringify(answer);
    }),
  };
};

describe('hostFetch', () => {
  let host;
  let next;
  beforeEach(() => {
    host = fakeHost({
      'GET api/gamelist/getgames': { status: 200, body: [{ id: 'g1', name: 'Game' }] },
      'GET api/backup/list': { status: 501, body: { error: 'only on a GM server' } },
      'GET api/Materials/Resource': { status: 200, body: { data: btoa('PNG!'), mimeType: 'image/png', version: 'v1' } },
      'POST api/session/g1/stop': { status: 204, body: null },
    });
    next = vi.fn(async () => new Response('from the network'));
  });

  it('answers the API from the host: method, path and query, JSON body', async () => {
    const fetchFn = hostFetch(host, next);
    const resp = await fetchFn(`${HOST_API}/gamelist/getgames?gameid=x`, { method: 'GET' });

    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual([{ id: 'g1', name: 'Game' }]);
    expect(host.calls[0]).toEqual({ method: 'GET', path: 'api/gamelist/getgames?gameid=x', body: null });
    expect(next).not.toHaveBeenCalled();
  });

  it('passes a JSON body on, and the status back (not ok)', async () => {
    const fetchFn = hostFetch(host, next);
    await fetchFn(`${HOST_API}/gamelist/addgame`, { method: 'POST', body: JSON.stringify({ name: 'New' }) });
    const meta = await fetchFn(`${HOST_API}/backup/list`);

    expect(host.calls[0]).toEqual({ method: 'POST', path: 'api/gamelist/addgame', body: { name: 'New' } });
    expect(meta.ok).toBe(false);
    expect(meta.status).toBe(501);
  });

  it('answers a status with no body (204) without one', async () => {
    const resp = await hostFetch(host, next)(`${HOST_API}/session/g1/stop`, { method: 'POST' });

    expect(resp.status).toBe(204);
    expect(await resp.text()).toBe('');
  });

  it('logs in and out through the host, not the endpoint (the host holds the Central tokens)', async () => {
    const fetchFn = hostFetch(host, next);

    const ok = await fetchFn(`${HOST_API}/User/login`, { method: 'POST', body: JSON.stringify({ UserName: 'gm', password: 'secret' }) });
    const wrong = await fetchFn(`${HOST_API}/user/login`, { method: 'POST', body: JSON.stringify({ UserName: 'gm', password: 'nope' }) });
    const out = await fetchFn(`${HOST_API}/user/logout`, { method: 'GET' });

    expect(ok.status).toBe(200);
    expect(wrong.status).toBe(401);
    expect(out.status).toBe(200);
    expect(host.Login).toHaveBeenCalledWith('gm', 'secret');
    expect(host.Logout).toHaveBeenCalled();
    expect(host.calls).toEqual([]);
  });

  it('gives a resource as its bytes, as the native server does', async () => {
    const resp = await hostFetch(host, next)(`${HOST_API}/Materials/Resource?id=r1&gameid=g1`);

    expect(resp.status).toBe(200);
    expect(resp.headers.get('content-type')).toBe('image/png');
    expect(await resp.text()).toBe('PNG!');
  });

  it("asks Central itself for its meta (a GM server fetches it for the GM app)", async () => {
    next = vi.fn(async () => new Response(JSON.stringify({ publicGamesAllowed: false }), { status: 200 }));
    const resp = await hostFetch(host, next, { central: 'https://central.example' })(`${HOST_API}/meta`);

    expect(await resp.json()).toEqual({ publicGamesAllowed: false });
    expect(next).toHaveBeenCalledWith('https://central.example/api/meta', expect.objectContaining({ method: 'GET' }));
    expect(host.Call).not.toHaveBeenCalled();
  });

  it('leaves every other URL to the real fetch', async () => {
    const fetchFn = hostFetch(host, next);
    await fetchFn('https://central.example/api/ice-servers', { credentials: 'include' });
    await fetchFn(new Request('http://localhost/other'));

    expect(next).toHaveBeenCalledTimes(2);
    expect(host.Call).not.toHaveBeenCalled();
  });

  it('accepts a Request and an absolute URL to HOST_API', async () => {
    const fetchFn = hostFetch(host, next);
    await fetchFn(new Request(new URL(`${HOST_API}/gamelist/getgames`, 'http://localhost/client/host/').href));

    expect(host.calls[0].path).toBe('api/gamelist/getgames');
  });

  it('tells about sessions starting and stopping (the tab is the server while one runs)', async () => {
    const onSessions = vi.fn();
    const fetchFn = hostFetch(host, next, { onSessions });
    await fetchFn(`${HOST_API}/session/g1/start`, { method: 'POST' });
    await fetchFn(`${HOST_API}/session/g1/stop`, { method: 'POST' });

    expect(onSessions.mock.calls.map((c) => [...c[0]])).toEqual([['g1'], []]);
  });
});

describe('HOST_API', () => {
  it('is what WebHelper uses in the host build', async () => {
    const source = (await import('../helpers/WebHelper.js?raw')).default;
    expect(source).toContain(`'${HOST_API}'`);
  });
});
