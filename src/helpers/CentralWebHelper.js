import TokenStore from './TokenStore';

const BASE_URL = process.env.REACT_APP_CENTRAL_URL
  ? process.env.REACT_APP_CENTRAL_URL + '/api'
  : '/api';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

// Exchanges the refresh token (an httpOnly cookie Central set at login) for a new
// access token. Central rotates the refresh token on every use, so two refreshes at
// once would revoke each other's token: calls in this tab share one request, and tabs
// take turns through a Web Lock (each finds the cookie the previous one left).
// Resolves true on success. Only a 401/403 ends the session — a 5xx, 429 or network
// error leaves it alone, so a hiccup at Central doesn't log anyone out.
let refreshInFlight = null;

export function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = withRefreshLock(requestRefresh).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function withRefreshLock(fn) {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  return locks?.request ? locks.request('nm-central-refresh', fn) : fn();
}

async function requestRefresh() {
  try {
    const resp = await fetch(`${BASE_URL}/user/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ refreshMode: 'cookie' }),
    });

    if (resp.status === 401 || resp.status === 403) {
      TokenStore.clear();
      return false;
    }
    if (!resp.ok) return false;

    const data = await resp.json();
    TokenStore.setAccessToken(data.accessToken);
    return true;
  } catch {
    return false;
  }
}

// Wraps fetch: on 401, tries one token refresh then retries the original request.
async function fetchWithRefresh(url, options) {
  const resp = await fetch(url, options);
  if (resp.status !== 401) return resp;

  const refreshed = await refreshAccessToken();
  if (!refreshed) return resp;

  return fetch(url, options);
}

async function safeJson(resp) {
  try {
    const text = await resp.text();
    if (!text) return undefined;
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export const CentralWebHelper = {
  BaseUrl: BASE_URL,

  getNoResp: (path, onok, onerror, onException) => {
    fetchWithRefresh(`${BASE_URL}/${path}`, {
      method: 'GET',
      credentials: 'include',
      headers: DEFAULT_HEADERS,
    })
      .then((resp) => {
        if (resp.ok) { if (onok) onok(); }
        else { if (onerror) onerror(resp); }
      })
      .catch((e) => {
        if (onException) onException(e);
        else console.error('CentralWebHelper.getNoResp:', e);
      });
  },

  // accessToken: optional, sent as a Bearer header for callers without a Central cookie
  // (the GM browser only holds the token handed over by its backend).
  getAsync: async (path, accessToken) => {
    try {
      const resp = await fetchWithRefresh(`${BASE_URL}/${path}`, {
        method: 'GET',
        credentials: 'include',
        headers: accessToken ? { ...DEFAULT_HEADERS, Authorization: `Bearer ${accessToken}` } : DEFAULT_HEADERS,
      });
      if (!resp.ok) return undefined;
      return safeJson(resp);
    } catch (e) {
      console.error('CentralWebHelper.getAsync:', e);
      return undefined;
    }
  },

  post: (path, body, onok, onerror, onException) => {
    fetchWithRefresh(`${BASE_URL}/${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(body),
    })
      .then(async (resp) => {
        if (resp.ok) {
          const data = await safeJson(resp);
          if (onok) onok(data);
        } else {
          if (onerror) onerror(resp);
        }
      })
      .catch((e) => {
        if (onException) onException(e);
        else console.error('CentralWebHelper.post:', e);
      });
  },

  postAsync: async (path, body) => {
    try {
      return await fetchWithRefresh(`${BASE_URL}/${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: DEFAULT_HEADERS,
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.error('CentralWebHelper.postAsync:', e);
      return undefined;
    }
  },
};

export default CentralWebHelper;
