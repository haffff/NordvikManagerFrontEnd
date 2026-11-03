import { WebHelper } from './WebHelper';
import TokenStore from './TokenStore';

// The GM app's Central access token (for signaling) comes from its GM backend: the GM's
// browser has no Central cookie, while the backend keeps the Central refresh token.
// Resolves true once a fresh token is stored, false when the backend says to log in again,
// and null when it couldn't be asked (or an older backend returned no token).
export async function refreshCentralTokenViaBackend() {
  try {
    const resp = await fetch(`${WebHelper.ApiAddress}/user/refresh-central`, {
      method: 'POST',
      credentials: 'include',
    });
    if (resp.status === 401 || resp.status === 403) return false;
    if (!resp.ok) return null;
    const data = await resp.json().catch(() => null);
    if (!data?.accessToken) return null;
    TokenStore.setAccessToken(data.accessToken);
    return true;
  } catch {
    return null;
  }
}
