// What kind of GM backend this is, and what it doesn't provide: GET api/Host/Info. A GM server
// provides everything; the browser host (the host build) lists its server-only routes, with why,
// and its limitations. The GM app hides what isn't there, and the host drawer shows the list.
import { useEffect, useState } from 'react';
import WebHelper from '../helpers/WebHelper';
import { ActiveWebHelper } from '../helpers/transport';

let pending = null;

/** The backend's host info, or null when it can't say (an older GM server). Asked once. */
export function loadHostInfo(get = (path) => WebHelper.getAsync(path)) {
  if (!pending) {
    pending = Promise.resolve(get('host/info')).then((info) => info ?? null, () => null);
    // Not known: ask again next time (e.g. before the GM logged in to the host).
    pending.then((info) => { if (!info) pending = null; });
  }
  return pending;
}

export function resetHostInfo() {
  pending = null;
}

/** Whether `path` (e.g. "api/Backup") is there; true while the info is unknown. */
export function isAvailable(info, path) {
  const wanted = path.toLowerCase();
  return !info?.unavailable?.some(({ path: missing }) => {
    const prefix = missing.toLowerCase();
    return wanted === prefix || wanted.startsWith(prefix + '/');
  });
}

/** The host info, once loaded (null until then, or when the backend can't say). */
export function useHostInfo() {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    let live = true;
    loadHostInfo().then((loaded) => { if (live) setInfo(loaded); });
    return () => { live = false; };
  }, []);
  return info;
}

/** Whether the backend lists the limitation `id` (e.g. "no-thumbnails"); false while unknown. */
export function hasLimitation(info, id) {
  return !!info?.limitations?.some((l) => l.id === id);
}

// In a game: the game's backend, asked over the game's own connection (players too: a game
// hosted in a browser has no thumbnails for anyone). Once per game.
const inGame = new Map();

/**
 * The game's backend's host info (null outside a game, or when it can't say). Asked once
 * per game; a null answer is asked again next time. Cards get it through CardAPI.Host.
 */
export function loadGameHostInfo(gameId, get = (path) => ActiveWebHelper.getAsync(path)) {
  if (!gameId) return Promise.resolve(null);
  if (!inGame.has(gameId)) {
    const pendingInfo = Promise.resolve().then(() => get('host/info')).then((info) => info ?? null, () => null);
    inGame.set(gameId, pendingInfo);
    pendingInfo.then((info) => { if (!info && inGame.get(gameId) === pendingInfo) inGame.delete(gameId); });
  }
  return inGame.get(gameId);
}

/** False when the game's backend makes no thumbnails (images would come at full size). */
export function useHasThumbnails() {
  const gameId = ActiveWebHelper.GameId;
  const [has, setHas] = useState(true);
  useEffect(() => {
    if (!gameId) return undefined;
    let live = true;
    loadGameHostInfo(gameId).then((info) => { if (live) setHas(!hasLimitation(info, 'no-thumbnails')); });
    return () => { live = false; };
  }, [gameId]);
  return has;
}
