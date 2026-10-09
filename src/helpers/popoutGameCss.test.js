import { describe, it, expect, afterEach } from 'vitest';
import { mirrorGameCss } from './popoutGameCss';
import { setAppliedGameCss } from './cardAppStyles';

// A popped-out window is a separate document: the game's custom CSS (a theme
// addon such as Imperium Maledictum) lives in the main document's
// adoptedStyleSheets and never reached it.
class FakeSheet {
  constructor() { this.text = ''; }
  replaceSync(text) { this.text = text; }
}

const fakeWindow = (existing = []) => ({
  CSSStyleSheet: FakeSheet,
  document: { adoptedStyleSheets: [...existing] },
});

describe('mirrorGameCss', () => {
  afterEach(() => setAppliedGameCss(''));

  it('applies the current game CSS to the window', () => {
    setAppliedGameCss(':root { --nordvik-accent: gold; }');
    const win = fakeWindow();

    mirrorGameCss(win);

    expect(win.document.adoptedStyleSheets).toHaveLength(1);
    expect(win.document.adoptedStyleSheets[0].text).toBe(':root { --nordvik-accent: gold; }');
  });

  it('keeps sheets the window already had, after them', () => {
    const own = new FakeSheet();
    const win = fakeWindow([own]);

    mirrorGameCss(win);

    expect(win.document.adoptedStyleSheets[0]).toBe(own);
    expect(win.document.adoptedStyleSheets).toHaveLength(2);
  });

  it('follows later changes to the game CSS', () => {
    const win = fakeWindow();
    mirrorGameCss(win);

    setAppliedGameCss('.nm_toolbar { color: red; }');

    expect(win.document.adoptedStyleSheets[0].text).toBe('.nm_toolbar { color: red; }');
  });

  it('stops following and removes its sheet when disposed', () => {
    setAppliedGameCss('a { color: red; }');
    const win = fakeWindow();
    const dispose = mirrorGameCss(win);

    dispose();
    setAppliedGameCss('a { color: blue; }');

    expect(win.document.adoptedStyleSheets).toHaveLength(0);
  });

  it('does nothing where the window has no constructable stylesheets', () => {
    const win = { document: {} };

    const dispose = mirrorGameCss(win);

    expect(win.document.adoptedStyleSheets).toBeUndefined();
    expect(() => dispose()).not.toThrow();
  });
});
