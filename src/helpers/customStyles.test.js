import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cssValueUrls,
  customStylesDisabled,
  getPersonalStylesheets,
  isAllowedStyleUrl,
  parseStylesheetList,
  sanitizeStyleSheet,
  setPersonalStylesheets,
} from './customStyles';

vi.mock('./transport', () => ({ ActiveWebHelper: {} }));

const opts = { origin: 'https://nordvik.test', materialPrefix: 'https://api.test/api/materials/resource?' };

describe('isAllowedStyleUrl', () => {
  it.each([
    ['data:image/png;base64,AAAA', true],
    ['/images/bg.png', true],
    ['bg.png', true],
    ['https://nordvik.test/x.png', true],
    ['https://api.test/api/Materials/Resource?id=abc', true],
    ['https://evil.test/track.png', false],
    ['//evil.test/track.png', false],
    ['https://api.test/api/other', false],
  ])('%s -> %s', (url, allowed) => {
    expect(isAllowedStyleUrl(url, opts)).toBe(allowed);
  });
});

describe('cssValueUrls', () => {
  it('finds url() in every quoting style and image-set() strings', () => {
    expect(cssValueUrls('url("a.png"), url(\'b.png\') no-repeat, url(c.png)')).toEqual(['a.png', 'b.png', 'c.png']);
    expect(cssValueUrls('image-set("x.png" 1x, url("y.png") 2x)')).toEqual(['y.png', 'x.png']);
    expect(cssValueUrls('red')).toEqual([]);
  });
});

// Just enough CSSOM for the sanitiser: rules with a style declaration list
// and/or nested cssRules.
const style = (decls) => {
  const entries = Object.entries(decls);
  return {
    get length() { return entries.length; },
    item: (i) => entries[i][0],
    getPropertyValue: (name) => entries.find(([n]) => n === name)?.[1] ?? '',
    removeProperty: (name) => { entries.splice(entries.findIndex(([n]) => n === name), 1); },
    names: () => entries.map(([n]) => n),
  };
};

describe('sanitizeStyleSheet', () => {
  it('drops declarations loading external URLs, anywhere in the sheet, and custom properties hiding escapes', () => {
    const panel = style({ color: 'red', 'background-image': 'url("https://evil.test/a.png")' });
    const inMedia = style({ 'background-image': 'url("data:image/png;base64,AA")', 'list-style-image': 'url("https://evil.test/b.png")' });
    const fontFace = style({ 'font-family': 'X', src: 'url("https://evil.test/f.woff")' });
    const vars = style({ '--bg': '\\75 rl(https://evil.test/c.png)', '--accent': '#f0a' });
    const sheet = {
      cssRules: [
        { style: panel },
        { cssRules: [{ style: inMedia }] },
        { style: fontFace },
        { style: vars },
      ],
    };

    const removed = sanitizeStyleSheet(sheet, (u) => isAllowedStyleUrl(u, opts));

    expect(removed).toBe(4);
    expect(panel.names()).toEqual(['color']);
    expect(inMedia.names()).toEqual(['background-image']);
    expect(fontFace.names()).toEqual(['font-family']);
    expect(vars.names()).toEqual(['--accent']);
  });
});

describe('stylesheet lists', () => {
  beforeEach(() => localStorage.clear());

  it('parses JSON id arrays, ignoring junk', () => {
    expect(parseStylesheetList('["a","b"]')).toEqual(['a', 'b']);
    expect(parseStylesheetList('[1,"a",""]')).toEqual(['a']);
    expect(parseStylesheetList('not json')).toEqual([]);
    expect(parseStylesheetList(undefined)).toEqual([]);
  });

  it('keeps personal stylesheets per game in this browser', () => {
    setPersonalStylesheets('game-1', ['a', 'b']);
    expect(getPersonalStylesheets('game-1')).toEqual(['a', 'b']);
    expect(getPersonalStylesheets('game-2')).toEqual([]);
  });

  it('?nostyles turns custom styling off', () => {
    expect(customStylesDisabled('?nostyles')).toBe(true);
    expect(customStylesDisabled('?nostyles=1&game=x')).toBe(true);
    expect(customStylesDisabled('?game=x')).toBe(false);
  });
});
