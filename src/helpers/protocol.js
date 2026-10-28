// Version of the protocol between the player client and the GM backend
// (WebRTC data channel commands and tunneled REST shapes).
//
// The GM backend announces its own number via Central's session-info. When it differs,
// the player switches to the frozen build for that protocol at /client/p<N>/ before
// connecting (see WebRTCManager's SESSION_INFO handler).
//
// Bump src/protocol.json only for changes an older backend can't handle, together with
// the backend's ProtocolVersion.Current (CI checks they match).
import protocolJson from '../protocol.json';

export const PROTOCOL_VERSION = protocolJson.protocol;

// Where the player client is served from on the Central Server.
const CLIENT_ROOT = '/client/';

export const clientPathForProtocol = (protocol) => `${CLIENT_ROOT}p${protocol}/`;

const ATTEMPTS = 3;
const MAX_WAIT_MS = 10_000;
const DEFAULT_WAIT_MS = 2_000;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * True if a frozen player build for this protocol is deployed. Only a 404 says it isn't:
 * the host may answer 429 (it rate-limits bursts of requests, like a page loading) or 5xx,
 * which says nothing about the folder; those are asked again after Retry-After (at most
 * 10 s), and if they never answer properly the build is taken as there. A network that
 * keeps failing means no.
 */
export async function clientExistsForProtocol(protocol, { sleep = wait } = {}) {
  let reachable = false;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const resp = await fetch(`${clientPathForProtocol(protocol)}index.html`, { method: 'HEAD', cache: 'no-store' });
      if (resp.ok) return true;
      if (resp.status === 404 || resp.status === 410) return false;
      reachable = true;
      if (attempt < ATTEMPTS) {
        const retryAfter = Number(resp.headers?.get?.('retry-after'));
        await sleep(Math.min(retryAfter > 0 ? retryAfter * 1000 : DEFAULT_WAIT_MS, MAX_WAIT_MS));
      }
    } catch {
      if (attempt < ATTEMPTS) await sleep(DEFAULT_WAIT_MS);
    }
  }
  return reachable;
}

export function navigateTo(url) {
  window.location.assign(url);
}
