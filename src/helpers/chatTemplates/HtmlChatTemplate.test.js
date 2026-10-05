import { act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders } from '../../setupTests';
import { HtmlChatTemplate, buildMessageDocument } from './HtmlChatTemplate';

const getMaterialAsync = vi.fn(() => Promise.resolve(new Blob(['.sheet-rolltemplate-x{color:blue}'], { type: 'application/octet-stream' })));
vi.mock('../transport', () => ({
  ActiveWebHelper: { getMaterialAsync: (...args) => getMaterialAsync(...args) },
}));

const d20 = (result) => ({ result, rolled: '{0}', dices: [{ index: 0, diceValue: 20, times: 1, result, kept: true }] });

describe('buildMessageDocument', () => {
  it('fills [data-roll-key] placeholders from the server-held rolls, never from the HTML', () => {
    const doc = buildMessageDocument(
      '<p>Attack: <span data-roll-key="attack">999</span></p>',
      [{ key: 'attack', roll: d20(14) }],
      ''
    );
    expect(doc).toContain('<span data-roll-key="attack" title="14 (d20: 14)">14</span>');
    expect(doc).not.toContain('999');
  });

  it('applies the sender-named crit / fumble / both classes from kept dice only', () => {
    const attrs = 'data-roll-crit-class="fullcrit" data-roll-fumble-class="fullfail" data-roll-both-class="importantroll"';
    const both = { result: 21, dices: [{ diceValue: 20, result: 20, kept: true }, { diceValue: 20, result: 1, kept: true }] };
    const droppedCrit = { result: 5, dices: [{ diceValue: 20, result: 20, kept: false }, { diceValue: 20, result: 5, kept: true }] };
    const doc = buildMessageDocument(
      `<span data-roll-key="c" ${attrs}></span><span data-roll-key="f" ${attrs}></span><span data-roll-key="b" ${attrs}></span><span data-roll-key="d" ${attrs}></span>`,
      [{ key: 'c', roll: d20(20) }, { key: 'f', roll: d20(1) }, { key: 'b', roll: both }, { key: 'd', roll: droppedCrit }],
      ''
    );
    const body = new DOMParser().parseFromString(doc, 'text/html');
    const cls = (k) => body.querySelector(`[data-roll-key="${k}"]`).className;
    expect(cls('c')).toBe('fullcrit');
    expect(cls('f')).toBe('fullfail');
    expect(cls('b')).toBe('importantroll');
    expect(cls('d')).toBe('');
  });

  it('strips inline event handlers and javascript: URLs, so a message never tries to run anything', () => {
    const doc = buildMessageDocument(
      '<div onclick="alert(1)" onMouseOver="x()"><a href="javascript:alert(2)">a</a><a href="~per">b</a><img src=" JavaScript:alert(3)"></div>',
      [],
      ''
    );
    expect(doc).not.toMatch(/onclick|onmouseover|javascript:/i);
    expect(doc).toContain('<a href="~per">b</a>');
  });

  it('makes links inert, so clicking one cannot navigate the message frame away', () => {
    expect(buildMessageDocument('<a href="~per">Reroll</a>', [], '')).toContain('a[href]{pointer-events:none;cursor:default}');
  });

  it('marks a placeholder with no matching roll instead of leaving sender-supplied text', () => {
    const doc = buildMessageDocument('<span data-roll-key="missing">42</span>', [], '');
    expect(doc).toContain('<span data-roll-key="missing">?</span>');
  });

  it('drops script/meta/base/iframe elements and keeps CSS from closing its <style> early', () => {
    const doc = buildMessageDocument(
      '<p>ok</p><script>alert(1)</script><meta http-equiv="refresh" content="0;url=x"><base href="https://evil.test/"><iframe src="x"></iframe>',
      [],
      '.a{color:red}</style><script>alert(2)</script>'
    );
    expect(doc).not.toMatch(/<script>alert\(1\)/);
    expect(doc).not.toMatch(/<meta http-equiv/);
    expect(doc).not.toMatch(/<base /);
    expect(doc).not.toMatch(/<iframe/);
    expect(doc).toContain('.a{color:red}<\\/style>');
  });
});

describe('HtmlChatTemplate', () => {
  let observers;

  beforeEach(() => {
    observers = [];
    global.IntersectionObserver = class {
      constructor(cb) { this.cb = cb; observers.push(this); }
      observe() {}
      disconnect() { this.disconnected = true; }
      reveal() { this.cb([{ isIntersecting: true }]); }
    };
    getMaterialAsync.mockClear();
  });

  afterEach(() => {
    delete global.IntersectionObserver;
  });

  const message = (key) => ({ type: 'Html', html: '<p>hi</p>', cssResourceKey: key, rolls: [] });

  it('renders no iframe until the message scrolls near the viewport', async () => {
    const { container } = renderWithProviders(<HtmlChatTemplate object={message('css-lazy')} />);
    expect(container.querySelector('iframe')).toBeNull();

    act(() => observers.forEach((o) => o.reveal()));

    await waitFor(() => expect(container.querySelector('iframe')).not.toBeNull());
    const frame = container.querySelector('iframe');
    expect(frame.getAttribute('sandbox')).toBe('allow-same-origin');
    expect(frame.getAttribute('srcdoc')).toContain('.sheet-rolltemplate-x{color:blue}');
  });

  it('fetches a shared stylesheet once per resource key, however many messages use it', async () => {
    const { container } = renderWithProviders(
      <>
        <HtmlChatTemplate object={message('css-shared')} />
        <HtmlChatTemplate object={message('css-shared')} />
        <HtmlChatTemplate object={message('css-shared')} />
      </>
    );
    act(() => observers.forEach((o) => o.reveal()));

    await waitFor(() => expect(container.querySelectorAll('iframe')).toHaveLength(3));
    expect(getMaterialAsync).toHaveBeenCalledTimes(1);
    expect(getMaterialAsync.mock.calls[0][2]).toBe('css-shared');
  });

  it('renders nothing without html', () => {
    const { container } = renderWithProviders(<HtmlChatTemplate object={{ type: 'Html' }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
