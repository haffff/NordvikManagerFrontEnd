// Older builds kept the refresh token here. It's now an httpOnly cookie that Central
// sets (refreshMode "cookie"), out of reach of page scripts; this key is only removed.
const LEGACY_REFRESH_KEY = 'nm_central_refresh_token';

// Access token lives in memory only (short-lived, not persisted across reloads).
let _accessToken = null;

const TokenStore = {
  getAccessToken: () => _accessToken,
  setAccessToken: (token) => { _accessToken = token ?? null; },

  clear: () => {
    _accessToken = null;
    try {
      localStorage.removeItem(LEGACY_REFRESH_KEY);
    } catch {
      /* storage unavailable — nothing stored there either */
    }
  },
};

export default TokenStore;
