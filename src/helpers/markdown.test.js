import { describe, it, expect } from 'vitest';
import { renderReadme, readmeBases } from './markdown';

const SOURCE = 'https://raw.githubusercontent.com/haffff/NordvikManager-Extras/poll-0.1.0/poll/README.md';
const dom = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d; };

describe('readmeBases', () => {
  it('gives the raw folder (images) and the GitHub page folder (links) of a raw readme', () => {
    expect(readmeBases(SOURCE)).toEqual({
      raw: 'https://raw.githubusercontent.com/haffff/NordvikManager-Extras/poll-0.1.0/poll/',
      page: 'https://github.com/haffff/NordvikManager-Extras/blob/poll-0.1.0/poll/',
    });
    expect(readmeBases('https://example.com/x.md')).toBeNull();
    expect(readmeBases(undefined)).toBeNull();
  });
});

describe('renderReadme', () => {
  it('renders markdown: headings, lists, tables, code', () => {
    const d = dom(renderReadme('# Poll\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n`code`', SOURCE));
    expect(d.querySelector('h1').textContent).toBe('Poll');
    expect(d.querySelectorAll('li')).toHaveLength(2);
    expect(d.querySelector('table td').textContent).toBe('1');
    expect(d.querySelector('code').textContent).toBe('code');
  });

  it('resolves relative images against the raw folder and relative links against the GitHub page', () => {
    const d = dom(renderReadme('![shot](img/shot.png) [guide](docs/guide.md) [top](../README.md)', SOURCE));
    expect(d.querySelector('img').getAttribute('src')).toBe('https://raw.githubusercontent.com/haffff/NordvikManager-Extras/poll-0.1.0/poll/img/shot.png');
    const [guide, top] = d.querySelectorAll('a');
    expect(guide.getAttribute('href')).toBe('https://github.com/haffff/NordvikManager-Extras/blob/poll-0.1.0/poll/docs/guide.md');
    expect(top.getAttribute('href')).toBe('https://github.com/haffff/NordvikManager-Extras/blob/poll-0.1.0/README.md');
  });

  it('opens links in a new tab, safely', () => {
    const a = dom(renderReadme('[site](https://nordvikmanager.pl)', SOURCE)).querySelector('a');
    expect(a.getAttribute('href')).toBe('https://nordvikmanager.pl/');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('drops raw HTML, scripts and unsafe links', () => {
    const d = dom(renderReadme('<script>alert(1)</script><img src=x onerror=alert(1)>\n\n[bad](javascript:alert(1)) ![bad](data:image/png;base64,AAA)', SOURCE));
    expect(d.querySelector('script')).toBeNull();
    // Raw HTML comes out as text; no element carries a handler or a script URL.
    for (const el of d.querySelectorAll('*')) {
      for (const attr of el.attributes) {
        expect(attr.name.startsWith('on'), `${el.tagName} ${attr.name}`).toBe(false);
        expect(attr.value).not.toMatch(/^\s*(javascript|data):/i);
      }
    }
    expect(d.querySelector('a[href^="javascript"]')).toBeNull();
    expect(d.querySelector('img[src^="data:"]')).toBeNull();
  });

  it('works without a source: relative links and images are left out', () => {
    const d = dom(renderReadme('![x](a.png) [y](b.md) [z](https://x.example/)', null));
    expect(d.querySelector('img')).toBeNull();
    expect(d.querySelectorAll('a')).toHaveLength(1);
    expect(renderReadme('', null)).toBe('');
  });
});
