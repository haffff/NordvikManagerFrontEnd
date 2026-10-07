import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  nordvikVariables,
  appVariablesCss,
  baseCardCss,
  appliedGameCss,
  setAppliedGameCss,
  onGameCssChange,
  cardStyleLinks,
  sheetText,
} from './cardAppStyles';

const decodeLink = (html, id) => {
  const match = html.match(new RegExp(`<link rel="stylesheet" id="${id}" href="data:text/css;charset=utf-8;base64,([^"]+)">`));
  if (!match) return null;
  return new TextDecoder().decode(Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0)));
};

describe('cardAppStyles', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--nordvik-surface-raised');
    setAppliedGameCss('');
  });

  it('knows the app variables: the ones index.css declares and the themeColors ones', () => {
    const names = nordvikVariables().map((v) => v.name);
    expect(names).toContain('text-color');
    expect(names).toContain('background-color');
    expect(names).toContain('surface-raised');
    expect(names).toContain('accent-gold');
    expect(new Set(names).size).toBe(names.length);
  });

  it("writes each variable's current value, or the app default when unset", () => {
    document.documentElement.style.setProperty('--nordvik-surface-raised', 'rebeccapurple');

    const css = appVariablesCss(document.documentElement);

    expect(css).toMatch(/^:root\s*\{/);
    expect(css).toContain('--nordvik-surface-raised: rebeccapurple;');
    expect(css).toContain('--nordvik-accent-gold: rgb(220,180,60);');
    expect(css).toContain('--nordvik-text-color: #f0f0f0;');
    expect(css).toMatch(/--nordvik-font: [^;]+;/);
  });

  it("the base CSS has the variables and the app's own nm_ classes", () => {
    const css = baseCardCss();
    expect(css).toContain('--nordvik-background-color');
    expect(css).toContain('.nm_basePanel');
    expect(css).toContain('.nm_label');
    expect(css).toContain('.nm_container');
  });

  it("follows the game's applied CSS and tells subscribers", () => {
    const seen = vi.fn();
    const off = onGameCssChange(seen);

    setAppliedGameCss('.nm_basePanel { color: gold; }');
    setAppliedGameCss('.nm_basePanel { color: gold; }'); // unchanged: no second call
    off();
    setAppliedGameCss('');

    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith('.nm_basePanel { color: gold; }');
    expect(appliedGameCss()).toBe('');
  });

  it("wraps a card's own CSS: app base first, the game's theme last", () => {
    setAppliedGameCss('.nm_basePanel { color: gold; } /* ąę */');

    const html = cardStyleLinks('<link rel="stylesheet" href="data:card">');

    const base = html.indexOf('id="nm-app-base"');
    const card = html.indexOf('href="data:card"');
    const theme = html.indexOf('id="nm-app-theme"');
    expect(base).toBeGreaterThanOrEqual(0);
    expect(base).toBeLessThan(card);
    expect(card).toBeLessThan(theme);
    expect(decodeLink(html, 'nm-app-theme')).toBe('.nm_basePanel { color: gold; } /* ąę */');
    expect(decodeLink(html, 'nm-app-base')).toContain('.nm_basePanel');
  });

  it("turns a stylesheet's rules back into text", () => {
    expect(sheetText({ cssRules: [{ cssText: 'a { color: red; }' }, { cssText: 'b { color: blue; }' }] }))
      .toBe('a { color: red; }\nb { color: blue; }');
    expect(sheetText(null)).toBe('');
  });
});
