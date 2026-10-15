import { describe, it, expect, vi } from 'vitest';
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
