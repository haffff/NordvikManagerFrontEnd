import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const { server, dock } = vi.hoisted(() => ({
  server: { appStyles: undefined },
  dock: { layoutContent: null, calls: [] },
}));

vi.mock('@hlorenzi/react-dockable', () => ({
  useContentContext: () => ({ setTitle: vi.fn(), layoutContent: dock.layoutContent }),
  removeContent: vi.fn((...args) => dock.calls.push(['removeContent', ...args])),
  coallesceEmptyPanels: vi.fn((...args) => dock.calls.push(['coallesceEmptyPanels', ...args])),
}));
vi.mock('../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));
vi.mock('../../uiComponents/hooks/useUUID', () => ({ default: () => 'panel-1' }));
vi.mock('../../../helpers/DockableHelper', () => ({ default: { getGlobalState: vi.fn() } }));
vi.mock('../../../CardAPI', () => ({ default: async () => ({ destroy: vi.fn() }) }));
const b64 = (text) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));
vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: {
    ApiAddress: 'https://gm.example/api',
    getAsync: vi.fn(async (path) => {
      if (path.startsWith('materials/getcard')) return { mainResource: 'main', additionalResources: ['css1'] };
      if (path.startsWith('properties/QueryProperties')) {
        return server.appStyles === undefined ? [] : [{ name: 'app_styles', value: server.appStyles }];
      }
      if (path === 'materials/ResourceMetadata?id=main') {
        return { mimeType: 'text/html', data: b64('<html><head></head><body><p>card</p></body></html>') };
      }
      if (path === 'materials/ResourceMetadata?id=css1') return { mimeType: 'text/css', data: b64('.card{}') };
      if (path === 'security/sandboxorigins') return { origins: ['https://cdn.example.com'] };
      return null;
    }),
  },
  ActiveTransportManager: { Subscribe: vi.fn(), Unsubscribe: vi.fn(), Send: vi.fn() },
}));

import { CardPanel } from './CardPanel';
import DockableHelper from '../../../helpers/DockableHelper';
import { setAppliedGameCss } from '../../../helpers/cardAppStyles';

const decode = (href) => new TextDecoder().decode(Uint8Array.from(atob(href.split(',')[1]), (c) => c.charCodeAt(0)));
const linkHref = (html, id) => html.match(new RegExp(`id="${id}" href="([^"]+)"`))?.[1];

// Renders a card and waits until its iframe points at the sandbox page.
async function openCard(name = 'Note') {
  const { container } = render(<CardPanel id="card-1" name={name} />);
  const frame = container.querySelector('iframe');
  await waitFor(() => expect(frame.getAttribute('src')).toBeTruthy());
  const posted = vi.spyOn(frame.contentWindow, 'postMessage');
  const fromFrame = (data) => act(() => window.dispatchEvent(new MessageEvent('message', { data, source: frame.contentWindow })));
  // The sandbox page announces itself; the card's HTML is sent in reply.
  const hostReady = () => {
    fromFrame({ type: 'SANDBOX_HOST_READY' });
    return posted.mock.calls.filter(([m]) => m.type === 'SANDBOX_LOAD').at(-1)?.[0].html;
  };
  return { frame, posted, fromFrame, hostReady };
}

describe('CardPanel, sandbox page', () => {
  it('loads the card into the sandbox page shipped with the app, not a blob: URL', async () => {
    URL.createObjectURL = vi.fn();
    const { frame } = await openCard();

    expect(frame.getAttribute('src')).toMatch(new RegExp('^' + new URL('sandbox.html', document.baseURI).href.replace(/[.?]/g, '\$&') + '#[0-9a-f-]{36}$'));
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('sends the card HTML, with the CardAPI bridge, once the sandbox page is ready', async () => {
    const { hostReady } = await openCard();

    const html = hostReady();

    expect(html).toContain('<p>card</p>');
    expect(html).toContain('window.CardAPI = CardAPI');
  });

  // The GM's host list (backend Security:SandboxAllowedOrigins) applies to the card even
  // on a player's client, whose sandbox page comes from the Central Server.
  it("limits the card to the GM's allowed hosts with a CSP first in its <head>", async () => {
    const { hostReady } = await openCard();

    const html = hostReady();

    expect(html).toMatch(/<head><meta http-equiv="Content-Security-Policy" content="[^"]*connect-src 'self' https:\/\/cdn\.example\.com/);
  });

  it('sends it again when the page reloads (a docked panel moved in the DOM), and initialises the card again', async () => {
    const { posted, fromFrame, hostReady } = await openCard();
    hostReady();
    fromFrame({ type: 'SANDBOX_READY' });

    expect(hostReady()).toContain('<p>card</p>');
    expect(posted.mock.calls.filter(([m]) => m.type === 'SANDBOX_LOAD')).toHaveLength(2);
    fromFrame({ type: 'SANDBOX_READY' });
    expect(posted.mock.calls.filter(([m]) => m.type === 'INIT')).toHaveLength(2);
  });
});

// Every message the host sends carries a per-frame nonce, taken from the sandbox page's
// URL fragment. Another card's frame can't read that URL, so it can't feed this frame
// a card or fake CardAPI results.
describe('CardPanel, sandbox nonce', () => {
  it('frames the sandbox page with a fresh nonce and sends it with every message', async () => {
    const { frame, posted, fromFrame, hostReady } = await openCard();
    const nonce = frame.getAttribute('src').split('#')[1];

    hostReady();
    fromFrame({ type: 'SANDBOX_READY' });

    expect(posted.mock.calls.length).toBeGreaterThan(1);
    for (const [message] of posted.mock.calls) expect(message.nonce).toBe(nonce);
  });

  it('builds the nonce into the CardAPI bridge', async () => {
    const { frame, hostReady } = await openCard();
    const nonce = frame.getAttribute('src').split('#')[1];

    expect(hostReady()).toContain(JSON.stringify(nonce));
  });

  it('gives each open card its own nonce', async () => {
    const a = await openCard('A');
    const b = await openCard('B');

    expect(a.frame.getAttribute('src')).not.toBe(b.frame.getAttribute('src'));
  });
});

describe('CardPanel, app styles', () => {
  beforeEach(() => {
    server.appStyles = undefined;
    setAppliedGameCss('.nm_basePanel { color: gold; }');
  });

  afterEach(() => setAppliedGameCss(''));

  it('a card whose template opts in gets the app base before its CSS and the theme after', async () => {
    server.appStyles = 'true';
    const pageHtml = (await openCard()).hostReady();

    const base = pageHtml.indexOf('id="nm-app-base"');
    const own = pageHtml.indexOf(`base64,${b64('.card{}')}`);
    const theme = pageHtml.indexOf('id="nm-app-theme"');
    expect(base).toBeGreaterThan(-1);
    expect(base).toBeLessThan(own);
    expect(own).toBeLessThan(theme);
    expect(decode(linkHref(pageHtml, 'nm-app-theme'))).toBe('.nm_basePanel { color: gold; }');
    expect(decode(linkHref(pageHtml, 'nm-app-base'))).toContain('.nm_basePanel');
  });

  it('other cards keep only their own styles', async () => {
    const pageHtml = (await openCard('Sheet')).hostReady();

    expect(pageHtml).not.toContain('id="nm-app-base"');
    expect(pageHtml).not.toContain('id="nm-app-theme"');
    expect(pageHtml).toContain(`base64,${b64('.card{}')}`);
  });

  it("an opted-in card is sent the new styles when the game's theme changes", async () => {
    server.appStyles = 'true';
    const { posted, fromFrame, hostReady } = await openCard();
    hostReady();
    // the page says it's ready, so messages are no longer queued
    fromFrame({ type: 'SANDBOX_READY' });

    act(() => setAppliedGameCss('.nm_basePanel { color: teal; }'));

    expect(posted).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'APP_STYLES', theme: '.nm_basePanel { color: teal; }', base: expect.stringContaining('.nm_basePanel') }),
      '*',
    );
  });
});

describe('CardPanel, closing from the card', () => {
  beforeEach(() => {
    dock.calls = [];
  });

  afterEach(() => {
    dock.layoutContent = null;
  });

  // Regression: Api.Close() (e.g. the 5e monster creator's exit) removed the card but
  // left its now-empty window open, so the panel looked cleared instead of closed.
  it('Api.Close removes the card and then the empty window', async () => {
    const panel = { contentList: [] };
    dock.layoutContent = { panel, content: { contentId: 7 } };
    const state = {};
    const commit = vi.fn(() => dock.calls.push(['commit']));
    DockableHelper.getGlobalState.mockReturnValue({ ref: { current: state }, commit });

    const { container } = render(<CardPanel id="card-1" name="Monster creator" />);
    await waitFor(() => expect(container.querySelector('iframe')?.src.startsWith(new URL('sandbox.html', document.baseURI).href + '#')).toBe(true));
    const frame = container.querySelector('iframe');

    act(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'CLOSE_PANEL' }, source: frame.contentWindow })));

    expect(dock.calls).toEqual([
      ['removeContent', state, panel, 7],
      ['coallesceEmptyPanels', state],
      ['commit'],
    ]);
  });
});
