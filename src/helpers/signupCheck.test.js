import { describe, it, expect, vi, afterEach } from 'vitest';
import { createChallenge, verifySolution } from 'altcha-lib/v1';
import { startSignupCheck, HONEYPOT_FIELD } from './signupCheck';

// The register forms solve Central's signup puzzle (ALTCHA) in the background while the
// user types, and send the answer with the registration. No puzzle (Central has the check
// off, or is older) means registering without one.

const decode = (altcha) => JSON.parse(atob(altcha));

describe('startSignupCheck', () => {
  afterEach(() => vi.useRealTimers());

  it('gives null when the server offers no puzzle', async () => {
    const check = startSignupCheck(async () => undefined);
    expect(await check.result).toBeNull();
  });

  it('solves the puzzle and gives the answer as the server checks it', async () => {
    const challenge = await createChallenge({ hmacKey: 'k', maxNumber: 500 });

    const altcha = await startSignupCheck(async () => ({ ...challenge, minAgeMs: 0 })).result;

    const payload = decode(altcha);
    expect(payload.signature).toBe(challenge.signature);
    expect(await verifySolution(payload, 'k')).toBe(true);
  });

  it('waits until the puzzle is old enough before answering', async () => {
    const challenge = await createChallenge({ hmacKey: 'k', maxNumber: 50 });
    let now = 1000;
    const waited = [];
    const check = startSignupCheck(async () => ({ ...challenge, minAgeMs: 2000 }), {
      now: () => now,
      sleep: async (ms) => { waited.push(ms); now += ms; },
    });

    expect(decode(await check.result).signature).toBe(challenge.signature);
    expect(waited).toEqual([2000]);
  });

  it('says why when the page cannot solve it (no secure context)', async () => {
    const challenge = await createChallenge({ hmacKey: 'k', maxNumber: 50 });
    vi.stubGlobal('crypto', {});
    try {
      await expect(startSignupCheck(async () => challenge).result).rejects.toThrow(/https/i);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('stops when aborted', async () => {
    const challenge = await createChallenge({ hmacKey: 'k', maxNumber: 5_000_000, number: 4_999_999 });
    const check = startSignupCheck(async () => challenge);
    check.abort();
    expect(await check.result).toBeNull();
  });

  it('names the hidden field as the server does', () => {
    expect(HONEYPOT_FIELD).toBe('nmTrapField');
  });
});
