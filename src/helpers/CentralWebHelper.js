import TokenStore from './TokenStore';

const BASE_URL = process.env.REACT_APP_CENTRAL_URL
  ? process.env.REACT_APP_CENTRAL_URL + '/api'
  : '/api';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

// Attempts to exchange the stored refresh token for a new access token (cookie).
// Returns true on success, false if the refresh token is missing or rejected.
async function tryRefresh() {
  const refreshToken = TokenStore.getRefreshToken();
  if (!refreshToken) return false;

  try {
    const resp = await fetch(`${BASE_URL}/user/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ refreshToken }),
    });

    if (!resp.ok) {
      TokenStore.clear();
      return false;
    }

    const data = await resp.json();
    TokenStore.setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// Wraps fetch: on 401, tries one token refresh then retries the original request.
async function fetchWithRefresh(url, options) {
  const resp = await fetch(url, options);
  if (resp.status !== 401) return resp;

  const refreshed = await tryRefresh();
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

  getAsync: async (path) => {
    try {
      const resp = await fetchWithRefresh(`${BASE_URL}/${path}`, {
        method: 'GET',
        credentials: 'include',
        headers: DEFAULT_HEADERS,
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
