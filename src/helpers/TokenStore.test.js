import { describe, it, expect, beforeEach } from 'vitest';
import TokenStore from './TokenStore';

// The access token lives in memory only; the refresh token is an httpOnly cookie
// Central sets, so nothing token-like is kept where page scripts could read it.
describe('TokenStore', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the access token in memory, not in storage', () => {
    TokenStore.setAccessToken('abc');

    expect(TokenStore.getAccessToken()).toBe('abc');
    expect(JSON.stringify({ ...localStorage })).not.toContain('abc');
  });

  it('clear() drops the access token and the old stored refresh token', () => {
    localStorage.setItem('nm_central_refresh_token', 'legacy');
    TokenStore.setAccessToken('abc');

    TokenStore.clear();

    expect(TokenStore.getAccessToken()).toBeNull();
    expect(localStorage.getItem('nm_central_refresh_token')).toBeNull();
  });

  it('has no refresh-token accessors any more', () => {
    expect(TokenStore.getRefreshToken).toBeUndefined();
    expect(TokenStore.setRefreshToken).toBeUndefined();
  });
});
