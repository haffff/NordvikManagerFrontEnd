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

// Whether a GM entry (https://host or https://*.host, optional port) covers an origin, as
// CSP matches it: a wildcard covers subdomains, not the bare domain; ports must agree.
const covers = (entry, origin) => {
  if (entry === origin) return true;
  const wild = /^https:\/\/\*\.(.+)$/i.exec(entry);
  if (!wild) return false;
  const m = /^https:\/\/([^/:]+)(:\d+)?$/i.exec(origin);
  const [suffix, port = ''] = wild[1].split(/(?=:\d+$)/);
  return !!m && (m[2] ?? '') === port && m[1].toLowerCase().endsWith('.' + suffix.toLowerCase());
};

/**
 * The hosts a card may reach. A card runs its addon's code (GetCard's addonKey, addonNetwork):
 * when that addon declares its hosts, only those the GM's list allows; when it doesn't say,
 * lets the user pick the address (userHosts), or the card is no addon's, the GM's list.
 */
export function cardOrigins(gmOrigins, card) {
  const network = card?.addonKey ? card.addonNetwork : null;
  if (!network || network.userHosts) return gmOrigins;
  return validOrigins(network.hosts ?? []).filter((host) => gmOrigins.some((entry) => covers(entry, host)));
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
