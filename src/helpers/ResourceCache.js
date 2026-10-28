import { getCacheLimitMB, setCacheLimitMB } from "./cacheSettings";

/**
 * Resources (images, audio, stylesheets) kept in the browser between sessions,
 * each with the version the server gave it, so a fetch can ask "still this
 * version?" instead of downloading the file again.
 *
 * Two IndexedDB stores: `meta` (key, size, lastUsed) for the size bookkeeping and
 * least-recently-used eviction, and `files` (the bytes) — so totalling or evicting
 * never loads the files themselves. Limited to the size the player chose
 * (cacheSettings). Every call swallows storage errors: without IndexedDB (private
 * window, blocked storage) it is a cache that never hits.
 */

const DB_NAME = "nordvik-resource-cache";
const META = "meta";
const FILES = "files";
const MB = 1024 * 1024;

let dbPromise = null;
let lastStamp = 0;
let persistAsked = false;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const idb = window.indexedDB;
      if (!idb) return resolve(null);
      const request = idb.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore(META, { keyPath: "key" }).createIndex("lastUsed", "lastUsed");
        db.createObjectStore(FILES, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

const done = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const committed = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

// Strictly increasing, so two uses in the same millisecond still have an order.
function now() {
  const t = Date.now();
  lastStamp = t > lastStamp ? t : lastStamp + 1;
  return lastStamp;
}

function askToPersist() {
  if (persistAsked) return;
  persistAsked = true;
  // So the browser doesn't clear the cache under storage pressure.
  try { navigator.storage?.persist?.()?.catch?.(() => {}); } catch { /* not supported */ }
}

async function removeOldestUntil(limitBytes) {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction([META, FILES], "readwrite");
  const meta = tx.objectStore(META);
  const files = tx.objectStore(FILES);
  const entries = (await done(meta.getAll())).sort((a, b) => a.lastUsed - b.lastUsed);
  let total = entries.reduce((sum, e) => sum + e.size, 0);
  for (const e of entries) {
    if (total <= limitBytes) break;
    meta.delete(e.key);
    files.delete(e.key);
    total -= e.size;
  }
  await committed(tx);
}

const ResourceCache = {
  /** { data: ArrayBuffer, mimeType, version } or null. Marks it as just used. */
  async get(key) {
    try {
      const db = await openDb();
      if (!db) return null;
      const tx = db.transaction([META, FILES], "readwrite");
      const meta = tx.objectStore(META);
      const [info, file] = await Promise.all([done(meta.get(key)), done(tx.objectStore(FILES).get(key))]);
      if (!info || !file) return null;
      meta.put({ ...info, lastUsed: now() });
      await committed(tx);
      return { data: file.data, mimeType: file.mimeType, version: file.version };
    } catch {
      return null;
    }
  },

  /** Stores { data: ArrayBuffer, mimeType, version }; false if it wasn't (off, too big, no storage). */
  async put(key, { data, mimeType, version }) {
    try {
      const limit = getCacheLimitMB() * MB;
      const db = await openDb();
      if (!db || limit <= 0) return false;
      const size = data.byteLength;
      if (size > limit) {
        await this.remove(key); // don't keep serving an older version of it
        return false;
      }
      const tx = db.transaction([META, FILES], "readwrite");
      tx.objectStore(META).put({ key, size, lastUsed: now() });
      tx.objectStore(FILES).put({ key, data, mimeType, version });
      await committed(tx);
      askToPersist();
      await removeOldestUntil(limit);
      return true;
    } catch {
      return false;
    }
  },

  async remove(key) {
    try {
      const db = await openDb();
      if (!db) return;
      const tx = db.transaction([META, FILES], "readwrite");
      tx.objectStore(META).delete(key);
      tx.objectStore(FILES).delete(key);
      await committed(tx);
    } catch { /* nothing to remove */ }
  },

  /** Bytes used. */
  async usage() {
    try {
      const db = await openDb();
      if (!db) return 0;
      const entries = await done(db.transaction(META).objectStore(META).getAll());
      return entries.reduce((sum, e) => sum + e.size, 0);
    } catch {
      return 0;
    }
  },

  async clear() {
    try {
      const db = await openDb();
      if (!db) return;
      const tx = db.transaction([META, FILES], "readwrite");
      tx.objectStore(META).clear();
      tx.objectStore(FILES).clear();
      await committed(tx);
    } catch { /* already empty */ }
  },

  /** Changes the size the player allows; evicts down to it straight away. */
  async setLimitMB(mb) {
    setCacheLimitMB(mb);
    try {
      await removeOldestUntil(getCacheLimitMB() * MB);
    } catch { /* storage unavailable */ }
  },

  async _resetForTests() {
    const db = await dbPromise;
    db?.close();
    dbPromise = null;
    lastStamp = 0;
    persistAsked = false;
  },
};

export default ResourceCache;
