import { describe, it, expect } from 'vitest';
import { withCardCsp } from './cardSandbox';

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

    expect(html).toMatch(/^<!DOCTYPE html><html><head lang="x"><meta http-equiv="Content-Security-Policy" content="[^"]*"><style>/);
    const csp = meta(html)[1];
    expect(csp).toContain("connect-src 'self' https://cdn.example.com");
    expect(csp).toContain("img-src 'self' data: blob: https://cdn.example.com");
    expect(csp).toContain("style-src 'self' 'unsafe-inline' data: https://cdn.example.com");
    expect(csp).toContain("font-src 'self' data: https://cdn.example.com");
    expect(csp).not.toMatch(/githubusercontent/);
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
      .toBe(new DOMParser().parseFromString(card, 'text/html').documentElement.outerHTML.replace(/<head([^>]*)>/, (m) => m + firstInHead(out).outerHTML));
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
