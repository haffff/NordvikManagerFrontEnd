import { ActiveWebHelper } from './transport';

// The GM's Security:SandboxAllowedOrigins (backend appsettings): the hosts addon cards
// and Html chat messages may load from. The backend enforces it on the GM app's sandbox
// page; player pages come from the Central Server, so the client enforces it itself
// (CardPanel's card CSP, HtmlChatTemplate's message CSP).

// Used until the backend answers, or when it can't (backend defaults too).
export const DEFAULT_SANDBOX_ORIGINS = [
  'https://raw.githubusercontent.com',
  'https://api.github.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

// https://host or https://*.host, optional port, nothing else — the list ends up inside
// a CSP and a content="..." attribute, so keywords, ";" and quotes must stay out.
const ORIGIN = /^https:\/\/(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*(:\d{1,5})?$/i;

export function validOrigins(list) {
  if (!Array.isArray(list)) return DEFAULT_SANDBOX_ORIGINS;
  return list
    .filter((o) => typeof o === 'string')
    .map((o) => o.trim())
    .filter((o) => ORIGIN.test(o));
}

let pending = null;

/** The GM's list, fetched once per game; the defaults if the backend has no answer. */
export function loadSandboxOrigins() {
  if (!pending) {
    pending = Promise.resolve()
      .then(() => ActiveWebHelper.getAsync('security/sandboxorigins'))
      .then((res) => {
        if (!Array.isArray(res?.origins)) throw new Error('no sandbox origins');
        return validOrigins(res.origins);
      })
      .catch(() => {
        pending = null; // ask again next time
        return DEFAULT_SANDBOX_ORIGINS;
      });
  }
  return pending;
}

/** Forget the list (a different game, possibly another GM's backend). */
export function resetSandboxOrigins() {
  pending = null;
}
