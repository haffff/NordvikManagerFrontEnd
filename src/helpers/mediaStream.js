// The page's side of media streaming (public/stream-sw.js): it registers the worker for this
// build's own scope (older player builds live in subfolders of the same origin and keep
// theirs), answers the worker's part requests over the game connection (rangeRead: 2 MB parts,
// cached per part) and hands out __stream URLs an <audio> or <video> can play while a worker
// controls the page. Without one (no service worker support, plain http) callers fall back to
// downloading the whole file.
import { readRange } from './rangeRead';

let started = false;

async function onWorkerMessage(event) {
  const msg = event.data;
  if (msg?.type !== 'nm-stream-read') return;
  const port = event.ports?.[0];
  if (!port) return;
  try {
    const part = await readRange(msg.ref, msg.start, msg.length);
    if (!part) { port.postMessage({ error: 'No such file.' }); return; }
    // A copy: the read's own buffer may still be on its way into the cache.
    const bytes = part.bytes.slice().buffer;
    port.postMessage({ bytes, total: part.total, mimeType: part.mimeType }, [bytes]);
  } catch (e) {
    port.postMessage({ error: String(e?.message ?? e) });
  }
}

/** Starts streaming support; false where service workers don't work (then nothing streams). */
export function startMediaStreaming({ navigator: nav = globalThis.navigator, secure = globalThis.isSecureContext } = {}) {
  const sw = nav?.serviceWorker;
  if (!sw || !secure) return false;
  if (started) return true;
  started = true;
  sw.addEventListener('message', onWorkerMessage);
  sw.register('./stream-sw.js', { scope: './' }).catch((e) => console.warn('[mediaStream] service worker not registered:', e?.message ?? e));
  return true;
}

/** A URL that streams the resource into an <audio>/<video>, or null when streaming isn't available. */
export function streamUrl(resourceId, { navigator: nav = globalThis.navigator, baseURI = globalThis.document?.baseURI } = {}) {
  if (!resourceId || !nav?.serviceWorker?.controller || !baseURI) return null;
  return new URL(`__stream/id/${encodeURIComponent(resourceId)}`, baseURI).href;
}

export function _resetForTests() { started = false; }
