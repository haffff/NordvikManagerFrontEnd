import * as React from 'react';
import { solveChallenge } from 'altcha-lib/v1';

// Central guards open registration with a small proof-of-work puzzle (ALTCHA) and a hidden
// "honeypot" field (Central's services/signupGuard.js). The register forms start solving as
// they open, so it's done by the time the user has typed; the answer counts once, so a
// failed try takes a fresh puzzle.

/** The hidden field's name; it must stay empty (a bot filling in the form fills it too). */
export const HONEYPOT_FIELD = 'nmTrapField';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches a puzzle with `fetchChallenge` (undefined = none: the server has the check off or
 * is older) and solves it. `result` resolves to the answer to send as `altcha`, or null for
 * none; it rejects when the page can't solve it (WebCrypto needs https or localhost).
 */
export function startSignupCheck(fetchChallenge, { now = Date.now, sleep = wait } = {}) {
  let aborted = false;
  let controller = null;

  const result = (async () => {
    const fetchedAt = now();
    const challenge = await fetchChallenge();
    if (aborted || !challenge?.challenge) return null;
    if (!globalThis.crypto?.subtle) {
      throw new Error('Registering needs a secure page: open this site over https (or on localhost).');
    }

    const solving = solveChallenge(challenge.challenge, challenge.salt, challenge.algorithm, challenge.maxnumber);
    controller = solving.controller;
    const solution = await solving.promise;
    if (aborted || !solution) return null;

    // Central refuses an answer that comes too soon after its puzzle was handed out.
    const early = (challenge.minAgeMs ?? 0) - (now() - fetchedAt);
    if (early > 0) await sleep(early);
    if (aborted) return null;

    return btoa(JSON.stringify({
      algorithm: challenge.algorithm,
      challenge: challenge.challenge,
      number: solution.number,
      salt: challenge.salt,
      signature: challenge.signature,
    }));
  })();

  return {
    result,
    abort() {
      aborted = true;
      controller?.abort();
    },
  };
}

/**
 * For a register form: solving starts on mount and stops on unmount. `getAltcha()` waits
 * for the answer (null = none needed); `renew()` starts a fresh puzzle after a failed try.
 */
export function useSignupCheck(fetchChallenge) {
  const fetchRef = React.useRef(fetchChallenge);
  fetchRef.current = fetchChallenge;
  const checkRef = React.useRef(null);

  const renew = React.useCallback(() => {
    checkRef.current?.abort();
    checkRef.current = startSignupCheck(() => fetchRef.current());
    // Kept for getAltcha; a failure shows when the user submits.
    checkRef.current.result.catch(() => {});
  }, []);

  React.useEffect(() => {
    renew();
    return () => checkRef.current?.abort();
  }, [renew]);

  const getAltcha = React.useCallback(() => checkRef.current?.result ?? Promise.resolve(null), []);
  return { getAltcha, renew };
}

/** The hidden honeypot input: off-screen, out of the tab order, never autofilled. */
export function HoneypotInput({ value, onChange }) {
  return (
    <input
      type="text"
      name={HONEYPOT_FIELD}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      style={{ position: 'absolute', left: '-10000px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }}
    />
  );
}
