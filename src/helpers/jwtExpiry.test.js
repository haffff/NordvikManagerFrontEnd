import { describe, it, expect } from 'vitest';
import { jwtExpiry, expiresWithin } from './jwtExpiry';

const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (payload) => `${b64({ alg: 'HS256' })}.${b64(payload)}.sig`;

describe('jwtExpiry', () => {
  it('reads exp from the payload', () => {
    expect(jwtExpiry(jwt({ exp: 1700000000 }))).toBe(1700000000);
  });

  it('is null for anything else', () => {
    expect(jwtExpiry(null)).toBeNull();
    expect(jwtExpiry('opaque-token')).toBeNull();
    expect(jwtExpiry('a.!!!.c')).toBeNull();
    expect(jwtExpiry(jwt({ sub: 'u' }))).toBeNull();
  });
});

describe('expiresWithin', () => {
  const now = 1_700_000_000_000;

  it('is true for an expired token and one expiring inside the margin', () => {
    expect(expiresWithin(jwt({ exp: now / 1000 - 1 }), 30_000, now)).toBe(true);
    expect(expiresWithin(jwt({ exp: now / 1000 + 10 }), 30_000, now)).toBe(true);
  });

  it('is false for a token good for longer, and for one whose expiry is unknown', () => {
    expect(expiresWithin(jwt({ exp: now / 1000 + 600 }), 30_000, now)).toBe(false);
    expect(expiresWithin('opaque-token', 30_000, now)).toBe(false);
  });
});
