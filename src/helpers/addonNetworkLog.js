// What addon code tried to reach and wasn't allowed to, this session (in memory; a reload
// forgets it). One entry per who + where + why, counting repeats:
//   source     "card" (the card's CSP blocked it, reported by its guard script) or
//              "action" (the GM backend refused an action's request)
//   addon      the addon's key, when known
//   card / cardId, action   who tried
//   origin     where to (origin only: never a path or query)
//   directive  the CSP directive that blocked a card ("connect-src", "img-src", ...)
//   reason     why the backend refused an action ("blocked-host", "undeclared-host",
//              "no-outside-connections", "network-error")
//   count, firstSeen, lastSeen

const entries = new Map();
const listeners = new Set();

const keyOf = (e) =>
  [e.source, e.addon ?? '', e.cardId ?? e.card ?? '', e.action ?? '', e.origin ?? '', e.directive ?? '', e.reason ?? ''].join('\u0000');

/** Adds a blocked attempt. True when it's new (not seen this session); subscribers hear only those. */
export function recordBlocked(attempt) {
  const key = keyOf(attempt);
  const now = Date.now();
  const known = entries.get(key);
  if (known) {
    known.count += 1;
    known.lastSeen = now;
    return false;
  }
  const entry = { ...attempt, count: 1, firstSeen: now, lastSeen: now };
  entries.set(key, entry);
  for (const listener of [...listeners]) {
    try {
      listener(entry);
    } catch (err) {
      console.error('addonNetworkLog: listener failed', err);
    }
  }
  return true;
}

/** The entries, oldest first; only one addon's when `addon` is given. */
export function getBlocked(addon) {
  const all = [...entries.values()];
  return addon === undefined ? all : all.filter((e) => e.addon === addon);
}

/** Calls `listener(entry)` for each new entry. Returns the unsubscribe function. */
export function subscribeBlocked(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Forgets everything (another game, tests). */
export function resetBlocked() {
  entries.clear();
}
