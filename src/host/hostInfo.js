// What kind of GM backend this is, and what it doesn't provide: GET api/Host/Info. A GM server
// provides everything; the browser host (the host build) lists its server-only routes, with why,
// and its limitations. The GM app hides what isn't there, and the host drawer shows the list.
import { useEffect, useState } from 'react';
import WebHelper from '../helpers/WebHelper';

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
