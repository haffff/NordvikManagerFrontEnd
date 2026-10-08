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

// True if a frozen player build for this protocol is deployed.
export async function clientExistsForProtocol(protocol) {
  try {
    const resp = await fetch(`${clientPathForProtocol(protocol)}index.html`, { method: 'HEAD', cache: 'no-store' });
    return resp.ok;
  } catch {
    return false;
  }
}

export function navigateTo(url) {
  window.location.assign(url);
}
