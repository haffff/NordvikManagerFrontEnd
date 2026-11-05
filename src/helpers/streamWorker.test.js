import { describe, it, expect, vi } from 'vitest';
import workerSource from '../../public/stream-sw.js?raw';

// The media streaming service worker (public/stream-sw.js), run against a fake `self`: an
// <audio>'s Range requests for .../__stream/<id|key>/<ref> become reads of aligned 2 MB parts,
// which the page answers over a MessageChannel; everything else is left to the network.
const PIECE = 2 * 1024 * 1024;

function load({ clients = [], answer } = {}) {
  const listeners = {};
  const asked = [];
  const pageClient = (id) => ({
    id,
    postMessage: (msg, [port]) => {
      asked.push({ client: id, ...msg });
      Promise.resolve(answer(msg)).then((reply) => port.postMessage(reply));
    },
  });
  const all = clients.map(pageClient);
  const self = {
    location: { origin: 'https://nordvik.test', href: 'https://nordvik.test/client/stream-sw.js' },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: vi.fn(),
    clients: {
      get: async (id) => all.find((c) => c.id === id),
      matchAll: async () => all,
      claim: vi.fn(async () => {}),
    },
  };
  new Function('self', workerSource)(self);
  const fetch = async (url, { range, clientId = clients[0], mode = 'no-cors', destination = 'audio' } = {}) => {
    let responded = null;
    listeners.fetch({
      clientId,
      request: { url, mode, destination, headers: { get: (h) => (h.toLowerCase() === 'range' ? range ?? null : null) } },
      respondWith: (p) => { responded = p; },
    });
    return responded && (await responded);
  };
  return { fetch, asked, listeners, self };
}

const file = (total, mimeType = 'audio/mpeg') => (msg) => {
  const length = Math.max(0, Math.min(msg.length, total - msg.start));
  const bytes = new Uint8Array(length).map((_, i) => (msg.start + i) % 251);
  return { bytes: bytes.buffer, total, mimeType };
};

describe('stream-sw.js', () => {
  it('leaves every other request to the network', async () => {
    const sw = load({ clients: ['page'], answer: file(10) });
    expect(await sw.fetch('https://nordvik.test/client/index.html')).toBeNull();
    expect(await sw.fetch('https://elsewhere.test/client/__stream/id/r1')).toBeNull();
    expect(await sw.fetch('https://nordvik.test/client/__stream/nope/r1')).toBeNull();
  });

  it('answers a range from the aligned part the page reads', async () => {
    const total = 5 * PIECE;
    const sw = load({ clients: ['page'], answer: file(total) });

    const res = await sw.fetch('https://nordvik.test/client/__stream/id/r1', { range: `bytes=${PIECE + 10}-` });

    expect(sw.asked).toEqual([{ client: 'page', type: 'nm-stream-read', ref: { id: 'r1' }, start: PIECE, length: PIECE }]);
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe(`bytes ${PIECE + 10}-${2 * PIECE - 1}/${total}`);
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body.length).toBe(PIECE - 10);
    expect(body[0]).toBe((PIECE + 10) % 251);
  });

  it('a request without Range starts at 0; a closed range gives just those bytes; keys work too', async () => {
    const sw = load({ clients: ['page'], answer: file(100, 'audio/ogg') });

    const whole = await sw.fetch('https://nordvik.test/client/__stream/key/music%2Ftheme.ogg');
    expect(sw.asked[0].ref).toEqual({ key: 'music/theme.ogg' });
    expect(whole.headers.get('Content-Range')).toBe('bytes 0-99/100');

    const probe = await sw.fetch('https://nordvik.test/client/__stream/key/music%2Ftheme.ogg', { range: 'bytes=0-1' });
    expect(probe.headers.get('Content-Range')).toBe('bytes 0-1/100');
    expect((await probe.arrayBuffer()).byteLength).toBe(2);
  });

  it('past the end: 416; the page failing: 502; no page to ask: 503', async () => {
    const sw = load({ clients: ['page'], answer: file(100) });
    expect((await sw.fetch('https://nordvik.test/client/__stream/id/r1', { range: 'bytes=500-' })).status).toBe(416);

    const failing = load({ clients: ['page'], answer: () => ({ error: 'gone' }) });
    expect((await failing.fetch('https://nordvik.test/client/__stream/id/r1')).status).toBe(502);

    const none = load({ clients: [], answer: file(100) });
    expect((await none.fetch('https://nordvik.test/client/__stream/id/r1', { clientId: '' })).status).toBe(503);
  });

  it('asks some page of its own when the request names none', async () => {
    const sw = load({ clients: ['other-tab'], answer: file(100) });
    const res = await sw.fetch('https://nordvik.test/client/__stream/id/r1', { clientId: '' });
    expect(res.status).toBe(206);
    expect(sw.asked[0].client).toBe('other-tab');
  });

  // Only media plays from here: a resource opened as a page (a player's HTML file in a link)
  // would otherwise run as the app's own page. Answers are never sniffed or run.
  it('never answers a page load, and serves only audio and video, unsniffed and sandboxed', async () => {
    const sw = load({ clients: ['page'], answer: file(100, 'text/html') });
    expect(await sw.fetch('https://nordvik.test/client/__stream/id/r1', { mode: 'navigate', destination: 'document' })).toBeNull();
    expect(await sw.fetch('https://nordvik.test/client/__stream/id/r1', { destination: 'iframe' })).toBeNull();
    expect((await sw.fetch('https://nordvik.test/client/__stream/id/r1')).status).toBe(415);

    const media = load({ clients: ['page'], answer: file(100, 'video/mp4') });
    const res = await media.fetch('https://nordvik.test/client/__stream/id/r1', { destination: 'video' });
    expect(res.status).toBe(206);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Content-Security-Policy')).toBe('sandbox');
  });

  it('a suffix range gives the last bytes; a part coming back short is an error, not a bad range', async () => {
    const total = 3 * PIECE;
    const sw = load({ clients: ['page'], answer: file(total) });
    const tail = await sw.fetch('https://nordvik.test/client/__stream/id/r1', { range: 'bytes=-10' });
    expect(tail.headers.get('Content-Range')).toBe(`bytes ${total - 10}-${total - 1}/${total}`);
    expect((await tail.arrayBuffer()).byteLength).toBe(10);

    const short = load({ clients: ['page'], answer: (msg) => ({ ...file(total)(msg), bytes: new Uint8Array(5).buffer }) });
    expect((await short.fetch('https://nordvik.test/client/__stream/id/r1', { range: 'bytes=100-' })).status).toBe(502);
  });

  it('takes over at once when installed', async () => {
    const sw = load({ clients: ['page'], answer: file(1) });
    sw.listeners.install({});
    let waited = null;
    sw.listeners.activate({ waitUntil: (p) => { waited = p; } });
    await waited;
    expect(sw.self.skipWaiting).toHaveBeenCalled();
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });
});
