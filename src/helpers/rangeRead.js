// Part of a resource (materials/resourcerange), kept in ResourceCache per part. Shared by the
// Card API (Resources.ReadRange) and media streaming (the service worker's range requests).
import { ActiveWebHelper as WebHelper } from "./transport";
import ResourceCache from "./ResourceCache";

// The version the server last named for a resource ("<game>:<id or key>") and when: a cached
// part of that version is served without asking again, for a few seconds (then the server is
// asked again, cheaply, with the version: the file may have changed meanwhile).
const knownVersions = new Map();
const TRUST_MS = 15000;

/** Forgets what the server said about a resource (it was just changed). */
export function forgetVersion(ref) {
  const id = ref?.id, key = ref?.key;
  if (id || key) knownVersions.delete(`${WebHelper.GameId}:${id || key}`);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Part of a resource (ref: { id } or { key }). Resolves to
 * { bytes: Uint8Array, start, total, version, mimeType } (bytes empty past the end), or null.
 * fresh: always ask the server (with the cached version, so an unchanged part isn't resent).
 */
export async function readRange(ref, start, length, { fresh = false } = {}) {
  const id = ref?.id, key = ref?.key;
  if (!id && !key) return null;
  const base = `${WebHelper.GameId}:${id || key}`;
  const cacheKey = `${base}@${start}+${length}`;
  const cached = await ResourceCache.get(cacheKey);
  const known = knownVersions.get(base);
  if (!fresh && cached && known && cached.version === known.version && Date.now() - known.at < TRUST_MS)
    return { bytes: new Uint8Array(cached.data), start, total: known.total, version: known.version, mimeType: cached.mimeType };

  const query = `${id ? `id=${encodeURIComponent(id)}` : `key=${encodeURIComponent(key)}`}&start=${start}&length=${length}`;
  const version = cached ? `&ifVersion=${encodeURIComponent(cached.version)}` : "";
  const resp = await WebHelper.getAsync(`materials/resourcerange?${query}${version}`);
  if (resp?.version) knownVersions.set(base, { version: resp.version, total: resp.total, at: Date.now() });

  if (resp?.notModified && cached)
    return { bytes: new Uint8Array(cached.data), start, total: resp.total, version: resp.version, mimeType: cached.mimeType };
  if (typeof resp?.data !== "string") return null;

  const bytes = base64ToBytes(resp.data);
  // Not awaited: storing mustn't delay the reader.
  if (resp.version && bytes.length)
    ResourceCache.put(cacheKey, { data: bytes.buffer, mimeType: resp.mimeType, version: resp.version });
  return { bytes, start: resp.start ?? start, total: resp.total, version: resp.version, mimeType: resp.mimeType };
}
