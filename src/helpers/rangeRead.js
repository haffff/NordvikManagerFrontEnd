// Part of a resource (materials/resourcerange), kept in ResourceCache per part. Shared by the
// Card API (Resources.ReadRange) and media streaming (the service worker's range requests).
import { ActiveWebHelper as WebHelper } from "./transport";
import ResourceCache from "./ResourceCache";

// The version the server last named for a resource this session ("<game>:<id or key>"):
// a cached part of that version is served without asking again.
const knownVersions = new Map();

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Part of a resource (ref: { id } or { key }). Resolves to
 * { bytes: Uint8Array, start, total, version, mimeType } (bytes empty past the end), or null.
 */
export async function readRange(ref, start, length) {
  const id = ref?.id, key = ref?.key;
  if (!id && !key) return null;
  const base = `${WebHelper.GameId}:${id || key}`;
  const cacheKey = `${base}@${start}+${length}`;
  const cached = await ResourceCache.get(cacheKey);
  const known = knownVersions.get(base);
  if (cached && known && cached.version === known.version)
    return { bytes: new Uint8Array(cached.data), start, total: known.total, version: known.version, mimeType: cached.mimeType };

  const query = `${id ? `id=${encodeURIComponent(id)}` : `key=${encodeURIComponent(key)}`}&start=${start}&length=${length}`;
  const version = cached ? `&ifVersion=${encodeURIComponent(cached.version)}` : "";
  const resp = await WebHelper.getAsync(`materials/resourcerange?${query}${version}`);
  if (resp?.version) knownVersions.set(base, { version: resp.version, total: resp.total });

  if (resp?.notModified && cached)
    return { bytes: new Uint8Array(cached.data), start, total: resp.total, version: resp.version, mimeType: cached.mimeType };
  if (typeof resp?.data !== "string") return null;

  const bytes = base64ToBytes(resp.data);
  // Not awaited: storing mustn't delay the reader.
  if (resp.version && bytes.length)
    ResourceCache.put(cacheKey, { data: bytes.buffer, mimeType: resp.mimeType, version: resp.version });
  return { bytes, start: resp.start ?? start, total: resp.total, version: resp.version, mimeType: resp.mimeType };
}
