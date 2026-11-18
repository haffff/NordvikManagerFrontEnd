// The host build's GM backend is the browser host running in this tab (NordvikManager.Wasm.Host:
// .NET in a worker, reached through HostPage's exports). The GM app talks to its backend with
// fetch() (WebHelper, and a few direct calls): in the host build WebHelper.ApiAddress is
// HOST_API, and hostFetch answers those requests from the host. They never reach the network.

/** WebHelper.ApiAddress in the host build: a path nothing serves. */
export const HOST_API = '/__nordvik-host__/api';

const NO_BODY = new Set([101, 204, 205, 304]);

const json = (status, body) => new Response(
  NO_BODY.has(status) || body === undefined || body === null ? null : JSON.stringify(body),
  { status, headers: { 'content-type': 'application/json' } },
);

function apiPath(input) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
  if (!raw) return null;
  const url = new URL(raw, globalThis.location?.href ?? 'http://localhost/');
  if (!url.pathname.startsWith(HOST_API + '/')) return null;
  return { path: 'api/' + url.pathname.slice(HOST_API.length + 1), query: url.search };
}

async function bodyOf(input, init) {
  const body = init?.body ?? (input instanceof Request ? await input.clone().text() : undefined);
  if (body === undefined || body === null || body === '') return null;
  if (typeof body !== 'string') throw new Error('The browser host takes JSON request bodies only.');
  return body;
}

const base64ToBytes = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

/**
 * A fetch that answers HOST_API requests from `host` (Login, Logout, Call) and passes
 * everything else to `next`. `onSessions(runningIds)` hears of sessions starting and stopping,
 * `onLogin()` of the GM logging in or out. `central` is the Central the host uses.
 */
export function hostFetch(host, next, { central = '', onSessions = () => {}, onLogin = () => {} } = {}) {
  const running = new Set();

  return async function fetch(input, init) {
    const target = apiPath(input);
    if (!target) return next(input, init);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const lower = target.path.toLowerCase();
    const body = await bodyOf(input, init);

    // The host holds the GM's Central tokens: logging in is its own, not an endpoint's.
    if (lower === 'api/user/login' && method === 'POST') {
      const form = JSON.parse(body ?? '{}');
      const ok = await host.Login(form.UserName ?? form.userName ?? form.username ?? '', form.password ?? form.Password ?? '');
      if (ok) onLogin();
      return ok ? json(200, {}) : json(401, { error: "Wrong user name or password, or Central can't be reached." });
    }
    if (lower === 'api/user/logout') {
      await host.Logout();
      running.clear();
      onSessions(new Set());
      onLogin();
      return json(200, {});
    }

    // Central's meta (public games allowed, invitations): a GM server fetches it for the GM app,
    // the browser host has the page ask Central itself.
    if (lower === 'api/meta') {
      return next(`${central.replace(/\/+$/, '')}/api/meta`, { method: 'GET' });
    }

    const answer = JSON.parse(await host.Call(method, target.path + target.query, body));

    const session = /^api\/session\/([^/]+)\/(start|stop)$/.exec(lower);
    if (session && answer.status < 300) {
      if (session[2] === 'start') running.add(session[1]);
      else running.delete(session[1]);
      onSessions(new Set(running));
    }

    // api/materials/resource is the base64 variant here (the router's rewrite): back to bytes.
    if (lower === 'api/materials/resource' && answer.status === 200 && typeof answer.body?.data === 'string') {
      return new Response(base64ToBytes(answer.body.data), {
        status: 200,
        headers: { 'content-type': answer.body.mimeType || 'application/octet-stream' },
      });
    }
    return json(answer.status, answer.body);
  };
}
