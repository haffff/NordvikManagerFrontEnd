// When a JWT expires, read from its payload (not verified: only to know when to refresh).

// Seconds since the epoch, or null for anything that isn't a JWT with an `exp`.
export function jwtExpiry(token) {
  const payload = typeof token === 'string' ? token.split('.')[1] : null;
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = JSON.parse(json).exp;
    return Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

// True when the token expires within `withinMs` (or already has). A token whose expiry
// can't be read counts as good: the server says otherwise if it isn't.
export function expiresWithin(token, withinMs, now = Date.now()) {
  const exp = jwtExpiry(token);
  return exp != null && exp * 1000 - now <= withinMs;
}
