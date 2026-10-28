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
