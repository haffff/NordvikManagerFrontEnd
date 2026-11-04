/* eslint-disable no-restricted-globals */
// Media streaming over the game connection. An <audio> (or <video>) whose src is
// <app>/__stream/id/<resource id> (or /key/<resource key>) asks for byte ranges; this service
// worker turns each into a read of an aligned 2 MB part, asks the page that plays it (which
// reads it over WebRTC and caches it, helpers/mediaStream.js) and answers with 206. So music
// starts after its first part and seeking works, without downloading the whole file first.
// Every other request is left alone (also those of older player builds under this scope).
const PIECE = 2 * 1024 * 1024;
const MARK = '/__stream/';
const PAGE_TIMEOUT_MS = 60000;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const at = url.pathname.indexOf(MARK);
  if (at < 0) return;
  const parts = url.pathname.slice(at + MARK.length).split('/');
  const kind = parts.shift();
  const value = decodeURIComponent(parts.join('/'));
  if ((kind !== 'id' && kind !== 'key') || !value) return;
  event.respondWith(answer(event, { [kind]: value }));
});

function parseRange(header) {
  const m = /^bytes=(\d+)-(\d*)$/.exec(String(header || '').trim());
  return m ? { start: Number(m[1]), end: m[2] === '' ? null : Number(m[2]) } : { start: 0, end: null };
}

async function pageFor(event) {
  const own = event.clientId ? await self.clients.get(event.clientId) : null;
  if (own) return own;
  const windows = await self.clients.matchAll({ type: 'window' });
  return windows[0] || null;
}

function ask(client, message) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve({ error: 'The page did not answer.' }), PAGE_TIMEOUT_MS);
    channel.port1.onmessage = (e) => { clearTimeout(timer); resolve(e.data); };
    client.postMessage(message, [channel.port2]);
  });
}

async function answer(event, ref) {
  const { start, end } = parseRange(event.request.headers.get('range'));
  const pieceStart = Math.floor(start / PIECE) * PIECE;
  const client = await pageFor(event);
  if (!client) return new Response(null, { status: 503 });

  const part = await ask(client, { type: 'nm-stream-read', ref, start: pieceStart, length: PIECE });
  if (!part || part.error || !part.bytes) return new Response(null, { status: 502 });
  const total = part.total;
  if (start >= total) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });

  const bytes = new Uint8Array(part.bytes);
  const last = Math.min(end === null ? Infinity : end, pieceStart + bytes.length - 1, total - 1);
  const body = bytes.slice(start - pieceStart, last - pieceStart + 1);
  return new Response(body, {
    status: 206,
    headers: {
      'Content-Type': part.mimeType || 'application/octet-stream',
      'Content-Range': `bytes ${start}-${last}/${total}`,
      'Content-Length': String(body.length),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    },
  });
}
