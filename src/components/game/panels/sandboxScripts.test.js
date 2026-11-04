import { describe, it, expect, vi, afterEach } from 'vitest';
import sandboxPage from '../../../../public/sandbox.html?raw';
import { sandboxBridgeScript } from './cardSandbox';

// Runs a page's inline <script> against a fake window, so the message handling can
// be checked without a real cross-origin frame.
function runScript(html, { hash }) {
  const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const listeners = [];
  const win = {
    addEventListener: (type, fn) => listeners.push({ type, fn }),
    removeEventListener: (type, fn) => listeners.splice(listeners.findIndex((l) => l.fn === fn), 1),
    dispatchEvent: vi.fn(),
  };
  const parent = { postMessage: vi.fn() };
  const document = { open: vi.fn(), write: vi.fn(), close: vi.fn(), getElementById: () => null };
  const location = { hash };
  new Function('window', 'parent', 'document', 'location', 'CustomEvent', code)(
    win, parent, document, location, class { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
  );
  const send = (data, source = parent) =>
    listeners.filter((l) => l.type === 'message').forEach((l) => l.fn({ data, source }));
  return { win, parent, document, send };
}

describe('public/sandbox.html', () => {
  it('writes the card only when the message carries the nonce from its URL', () => {
    const page = runScript(sandboxPage, { hash: '#n-1' });

    page.send({ type: 'SANDBOX_LOAD', html: '<p>evil</p>', nonce: 'guess' });
    page.send({ type: 'SANDBOX_LOAD', html: '<p>evil</p>' });
    expect(page.document.write).not.toHaveBeenCalled();

    page.send({ type: 'SANDBOX_LOAD', html: '<p>card</p>', nonce: 'n-1' });
    expect(page.document.write).toHaveBeenCalledWith('<p>card</p>');
  });
});

describe('CardAPI bridge', () => {
  it('ignores messages without its nonce, even when they arrive first', () => {
    const frame = runScript(sandboxBridgeScript('n-2'), { hash: '' });

    frame.send({ type: 'INIT', cardId: 'fake', nonce: 'nope' }, { other: true });
    expect(frame.win.dispatchEvent).not.toHaveBeenCalled();

    frame.send({ type: 'INIT', cardId: 'card-1', nonce: 'n-2' });
    expect(frame.win.dispatchEvent).toHaveBeenCalledTimes(1);
    expect(frame.win.dispatchEvent.mock.calls[0][0].type).toBe('cardapi:ready');
  });
});

describe('CardAPI bridge, calls to the app', () => {
  afterEach(() => vi.useRealTimers());

  const ready = () => {
    const frame = runScript(sandboxBridgeScript('n-3'), { hash: '' });
    frame.send({ type: 'INIT', cardId: 'card-1', nonce: 'n-3' });
    const posted = (type) => frame.parent.postMessage.mock.calls.map(([m]) => m).filter((m) => m.type === type);
    return { frame, api: frame.win.CardAPI, posted };
  };

  it('sends mediator calls apart from its own Properties calls', () => {
    const { api, posted } = ready();

    api.ClientMediator.sendCommandAsync('Properties', 'Add', { x: 1 });

    expect(posted('CMD').at(-1)).toMatchObject({ panel: '__mediator__', command: 'Properties', data: { command: 'Add', data: { x: 1 } } });
  });

  it('rejects a call the app never answers', async () => {
    vi.useFakeTimers();
    const { api } = ready();

    const call = api.Properties.Get('hp');
    vi.advanceTimersByTime(30_001);

    await expect(call).rejects.toThrow('no answer from the app');
  });

  // Uploads go over the paced game connection; a large image can take a while.
  it('gives resource uploads five minutes', async () => {
    vi.useFakeTimers();
    const { api } = ready();
    let settled = false;

    const upload = api.Resources.Upsert('portrait', 'data').finally(() => { settled = true; });
    vi.advanceTimersByTime(60_000);
    await Promise.resolve();
    expect(settled).toBe(false);

    vi.advanceTimersByTime(240_001);
    await expect(upload).rejects.toThrow('no answer from the app');
  });

  it('sends Resources.ReadById and Resources.List to the app', () => {
    const { api, posted } = ready();

    api.Resources.ReadById('res-1');
    api.Resources.List({ mimeType: 'application/pdf' });

    expect(posted('CMD').slice(-2)).toEqual([
      expect.objectContaining({ panel: 'Resources', command: 'ReadById', data: { id: 'res-1' } }),
      expect.objectContaining({ panel: 'Resources', command: 'List', data: { filter: { mimeType: 'application/pdf' } } }),
    ]);
  });

  it('sends Resources.ReadRange, and Global.Create with its options, to the app', () => {
    const { api, posted } = ready();

    api.Resources.ReadRange({ id: 'res-1' }, 1024, 4096);
    api.Resources.Global.Create('k', 'data', 'Book.pdf', 'application/pdf', { storage: 'file' });

    expect(posted('CMD').slice(-2)).toEqual([
      expect.objectContaining({ panel: 'Resources', command: 'ReadRange', data: { ref: { id: 'res-1' }, start: 1024, length: 4096 } }),
      expect.objectContaining({ panel: 'Resources', command: 'Create', data: expect.objectContaining({ key: 'k', global: true, options: { storage: 'file' } }) }),
    ]);
  });

  it('refuses to send a server command cards may not send', () => {
    const { api, posted } = ready();

    expect(() => api.SendCustomCommandToServer('game_delete', {})).toThrow('may not send "game_delete"');
    // custom_* are real server commands too (custom_panel_delete, custom_layer_add, …).
    expect(() => api.SendCustomCommandToServer('custom_panel_delete', {})).toThrow('may not send');
    api.SendCustomCommandToServer('chat_push', 'hi');

    expect(posted('WS_SEND').map((m) => m.command)).toEqual(['chat_push']);
  });

  it('registers a panel: the handlers stay here and answer the calls the app forwards', async () => {
    const { frame, api, posted } = ready();
    const next = vi.fn(async ({ by }) => by * 2);

    const registered = api.ClientMediator.register('addon_tracker', { Next: next, Broken: () => { throw new Error('nope'); } });
    const cmd = posted('CMD').at(-1);
    expect(cmd).toMatchObject({ panel: '__register__', command: 'addon_tracker', data: { commands: ['Next', 'Broken'] } });
    frame.send({ type: 'CMD_RESULT', reqId: cmd.reqId, result: 'addon_card-1_tracker', nonce: 'n-3' });
    expect(await registered).toBe('addon_card-1_tracker');

    frame.send({ type: 'MEDIATOR_CALL', reqId: 'm1', name: 'addon_tracker', command: 'Next', data: { by: 21 }, nonce: 'n-3' });
    frame.send({ type: 'MEDIATOR_CALL', reqId: 'm2', name: 'addon_tracker', command: 'Broken', data: {}, nonce: 'n-3' });
    frame.send({ type: 'MEDIATOR_CALL', reqId: 'm3', name: 'addon_other', command: 'Next', data: {}, nonce: 'n-3' });
    await vi.waitFor(() => expect(posted('MEDIATOR_RESULT')).toHaveLength(3));

    const results = Object.fromEntries(posted('MEDIATOR_RESULT').map((m) => [m.reqId, m]));
    expect(results.m1).toMatchObject({ result: 42 });
    expect(results.m2.error).toContain('nope');
    expect(results.m3.error).toContain('addon_other');
    expect(next).toHaveBeenCalledWith({ by: 21 });
  });

  it('a call without the nonce never reaches a handler', () => {
    const { frame, api } = ready();
    const handler = vi.fn();
    api.ClientMediator.register('addon_t', { Go: handler });

    frame.send({ type: 'MEDIATOR_CALL', reqId: 'x', name: 'addon_t', command: 'Go', data: {}, nonce: 'guess' });

    expect(handler).not.toHaveBeenCalled();
  });
});

// The card's file handle (Resources.Open) and Upload, on the frame side: card code reads any
// bytes, the whole file or text, and uploads with progress; the bridge does the pieces.
describe('CardAPI bridge — Resources.Open and Upload', () => {
  const PIECE = 256 * 1024;
  const SIZE = 600 * 1024; // three pieces, the last one short
  const byteAt = (i) => i % 251;

  // A frame whose host answers Resources calls at once, like CardPanel with CardAPI.
  const withHost = (handlers) => {
    const frame = runScript(sandboxBridgeScript('n-9'), { hash: '' });
    frame.send({ type: 'INIT', cardId: 'card-1', nonce: 'n-9' });
    const calls = [];
    frame.parent.postMessage.mockImplementation((msg) => {
      if (msg.type !== 'CMD' || msg.panel !== 'Resources') return;
      calls.push({ command: msg.command, data: msg.data });
      Promise.resolve(handlers[msg.command]?.(msg.data, (m) => frame.send({ ...m, reqId: msg.reqId, nonce: 'n-9' })))
        .then((result) => frame.send({ type: 'CMD_RESULT', reqId: msg.reqId, result, nonce: 'n-9' }));
    });
    return { api: frame.win.CardAPI, calls };
  };
  const readRange = ({ start, length }) => ({ bytes: Uint8Array.from({ length }, (_, i) => byteAt(start + i)), start, total: SIZE });

  it('Open gives a handle: size and type, any bytes (read in whole pieces, each once), the whole file', async () => {
    const { api, calls } = withHost({
      Open: ({ ref }) => ({ ref: { key: ref }, size: SIZE, mimeType: 'application/pdf', version: 'v1' }),
      ReadRange: readRange,
      ReadWhole: () => new Blob(['%PDF-1.7']),
    });

    const file = await api.Resources.Open('pdf_src_a.pdf');
    expect(file).toMatchObject({ size: SIZE, mimeType: 'application/pdf', version: 'v1' });

    const bytes = await file.read(PIECE - 2, PIECE + 3);
    expect([...bytes]).toEqual([PIECE - 2, PIECE - 1, PIECE, PIECE + 1, PIECE + 2].map(byteAt));
    await file.read(PIECE, PIECE + 10); // the second piece again: not asked for again
    const ranges = calls.filter((c) => c.command === 'ReadRange').map((c) => [c.data.start, c.data.length]);
    expect(ranges).toEqual([[0, PIECE], [PIECE, PIECE]]);

    expect((await file.read(2 * PIECE, SIZE)).length).toBe(SIZE - 2 * PIECE);
    expect(calls.at(-1).data).toEqual({ ref: { key: 'pdf_src_a.pdf' }, start: 2 * PIECE, length: SIZE - 2 * PIECE });

    const blob = await file.blob();
    expect(blob.type).toBe('application/pdf');
  });

  it('Open of a missing file is null', async () => {
    const { api } = withHost({ Open: () => null });
    expect(await api.Resources.Open({ id: 'gone' })).toBeNull();
  });

  it('Upload sends the file with its options and reports progress as it comes', async () => {
    const { api, calls } = withHost({
      Upload: (data, progress) => { progress({ type: 'RESOURCE_PROGRESS', fraction: 0.5 }); progress({ type: 'RESOURCE_PROGRESS', fraction: 1 }); return { id: 'res-1', key: 'card-1/book.pdf' }; },
    });
    const seen = [];

    const result = await api.Resources.Upload('data', { key: 'book.pdf', storage: 'file' }, (f) => seen.push(f));

    expect(result).toEqual({ id: 'res-1', key: 'card-1/book.pdf' });
    expect(calls[0]).toEqual({ command: 'Upload', data: { data: 'data', options: { key: 'book.pdf', storage: 'file' } } });
    expect(seen).toEqual([0.5, 1]);
  });
});
