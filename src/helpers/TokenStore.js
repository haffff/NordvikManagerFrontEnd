const REFRESH_KEY = 'nm_central_refresh_token';

// Access token lives in memory only (short-lived, not persisted across reloads).
// Refresh token lives in localStorage so it survives reloads.
let _accessToken = null;

const TokenStore = {
  // Access token (in-memory)
  getAccessToken: () => _accessToken,
  setAccessToken: (token) => { _accessToken = token; },

  // Refresh token (localStorage)
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
  setRefreshToken: (token) => localStorage.setItem(REFRESH_KEY, token),

  // Set both at once (after login or refresh)
  setTokens: (accessToken, refreshToken) => {
    _accessToken = accessToken;
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },

  clear: () => {
    _accessToken = null;
    localStorage.removeItem(REFRESH_KEY);
  },
};

export default TokenStore;
