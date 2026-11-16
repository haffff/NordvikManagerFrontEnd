import { describe, it, expect, vi } from 'vitest';
import { withCardCsp, CARD_GUARD_SCRIPT } from './cardSandbox';

// The card's own CSP, from the GM's host list. It goes first in <head>, before any of the
// card's styles or scripts, and can only tighten the sandbox page's header policy.
const isPolicyFirst = (html) => {
  const el = new DOMParser().parseFromString(html, 'text/html').head.firstElementChild;
  return el?.tagName === 'META' && el.getAttribute('http-equiv') === 'Content-Security-Policy';
};
const meta = (html) => html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/);

describe('withCardCsp', () => {
  it('puts the policy first in <head>, with the GM\'s hosts on every fetch directive', () => {
    const html = withCardCsp('<!doctype html><html><head lang="x"><style>a{}</style></head><body></body></html>', ['https://cdn.example.com']);

    expect(html).toMatch(/^<!DOCTYPE html><html><head lang="x"><meta http-equiv="Content-Security-Policy" content="[^"]*"><script>[^<]*<\/script><style>/);
    const csp = meta(html)[1];
    expect(csp).toContain("connect-src 'self' https://cdn.example.com");
    expect(csp).toContain("img-src 'self' data: blob: https://cdn.example.com");
    expect(csp).toContain("style-src 'self' 'unsafe-inline' data: https://cdn.example.com");
    expect(csp).toContain("font-src 'self' data: https://cdn.example.com");
    expect(csp).not.toMatch(/githubusercontent/);
  });

  // A frame inside a card would be a fresh window: framing the sandbox page itself runs it
  // without this policy (the Central Server's header allows any https: host), and any frame
  // gets back what the card's window had taken away.
  it('lets the card create no frames', () => {
    const csp = meta(withCardCsp('<head></head><iframe src="sandbox.html#x"></iframe>', ['https://cdn.example.com']))[1];
    expect(csp).toMatch(/(^|; )frame-src 'none'(;|$)/);
  });

  it('adds a <head> for it when the card has none', () => {
    for (const card of ['<html><body>x</body></html>', '<!DOCTYPE html><p>x</p>', '<p>x</p>']) {
      expect(isPolicyFirst(withCardCsp(card, []))).toBe(true);
    }
  });

  it('does not mistake <header> for <head>', () => {
    const out = withCardCsp('<html><body><header>h</header></body></html>', []);
    expect(isPolicyFirst(out)).toBe(true);
    expect(out).toContain('<header>h</header>');
  });

  // The browser builds the same tree DOMParser does, so check it there: the policy must be
  // the first thing in the real <head>, with nothing able to load or run before it.
  const firstInHead = (html) => new DOMParser().parseFromString(html, 'text/html').head.firstElementChild;
  const isPolicy = (el) => el?.tagName === 'META' && el.getAttribute('http-equiv') === 'Content-Security-Policy';

  it.each([
    ['a <head> inside a comment', '<!doctype html><!-- <head> --><html><head><style>a{}</style></head><body></body></html>'],
    ['a script before <head>', '<html><script>window.x = 1</script><head></head><body></body></html>'],
    ['"<head>" inside a script', '<html><head><script>var s = "<head>";</script></head><body></body></html>'],
  ])('lands first in the real <head> despite %s', (_, card) => {
    const out = withCardCsp(card, ['https://cdn.example.com']);

    expect(isPolicy(firstInHead(out))).toBe(true);
    // The card's own content survives the round trip.
    expect(new DOMParser().parseFromString(out, 'text/html').documentElement.outerHTML)
      .toBe(new DOMParser().parseFromString(card, 'text/html').documentElement.outerHTML.replace(/<head([^>]*)>/, (m) => m + firstInHead(out).outerHTML + firstInHead(out).nextElementSibling.outerHTML));
  });

  it('keeps the doctype, and keeps a card without one in quirks mode', () => {
    expect(withCardCsp('<!DOCTYPE html><p>x</p>', [])).toMatch(/^<!DOCTYPE html>/i);
    expect(withCardCsp('<p>x</p>', [])).not.toMatch(/doctype/i);
  });

  it('allows no outside host when the list is empty, and drops invalid entries', () => {
    const csp = meta(withCardCsp('<head></head>', ['https://a.com" x="', 'http://b.com']))[1];
    expect(csp).toContain("connect-src 'self';");
    expect(csp).not.toMatch(/a\.com|b\.com/);
  });
});

// Right after the policy, before anything of the card's, the guard script reports what the
// policy blocks: the directive and the origin only (never the path or query, which can
// carry the card's data), each pair once.
describe('the card guard script', () => {
  const runGuard = (window = {}) => {
    const listeners = {};
    const document = { addEventListener: (type, fn) => { listeners[type] = fn; } };
    const parent = { postMessage: vi.fn() };
    new Function('window', 'document', 'parent', 'URL', CARD_GUARD_SCRIPT)(window, document, parent, URL);
    const violate = (blockedURI, effectiveDirective = 'connect-src') =>
      listeners.securitypolicyviolation?.({ blockedURI, effectiveDirective });
    return { parent, violate };
  };

  it('comes right after the policy', () => {
    const head = new DOMParser().parseFromString(withCardCsp('<head><style>a{}</style></head>', []), 'text/html').head;
    expect(head.children[1].tagName).toBe('SCRIPT');
    expect(head.children[1].textContent).toBe(CARD_GUARD_SCRIPT);
  });

  it('posts the directive and the origin of a blocked address, once per pair', () => {
    const { parent, violate } = runGuard();

    violate('https://evil.example.com/steal?hp=12');
    violate('https://evil.example.com/again');
    violate('https://evil.example.com/pic.png', 'img-src');
    violate('wss://socket.example.com/x');

    expect(parent.postMessage.mock.calls).toEqual([
      [{ type: 'CARD_BLOCKED', directive: 'connect-src', origin: 'https://evil.example.com' }, '*'],
      [{ type: 'CARD_BLOCKED', directive: 'img-src', origin: 'https://evil.example.com' }, '*'],
      [{ type: 'CARD_BLOCKED', directive: 'connect-src', origin: 'wss://socket.example.com' }, '*'],
    ]);
  });

  it("says nothing about what isn't an outside address (inline code, eval, data:)", () => {
    const { parent, violate } = runGuard();

    violate('inline', 'script-src-elem');
    violate('eval', 'script-src');
    violate('data', 'img-src');
    violate('');

    expect(parent.postMessage).not.toHaveBeenCalled();
  });

  // CSP can't stop WebRTC: a peer connection reaches any STUN/TURN server. The card's own
  // window has none, read only (best effort: see CARD_GUARD_SCRIPT).
  it("takes WebRTC away from the card's window", () => {
    const window = { RTCPeerConnection: class {}, webkitRTCPeerConnection: class {}, RTCDataChannel: class {}, RTCSessionDescription: class {}, RTCIceCandidate: class {}, fetch: () => {} };
    runGuard(window);

    for (const name of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel', 'RTCSessionDescription', 'RTCIceCandidate']) {
      expect(window[name], name).toBeUndefined();
      // Putting it back is refused (throws in strict code, ignored otherwise).
      try { window[name] = class {}; } catch { /* read only */ }
      expect(window[name], name + ' again').toBeUndefined();
    }
    expect(typeof window.fetch).toBe('function');
  });
});
