import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const { server } = vi.hoisted(() => ({ server: { appStyles: undefined } }));

vi.mock('@hlorenzi/react-dockable', () => ({ useContentContext: () => ({ setTitle: vi.fn(), layoutContent: null }) }));
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
      return null;
    }),
  },
  ActiveTransportManager: { Subscribe: vi.fn(), Unsubscribe: vi.fn(), Send: vi.fn() },
}));

import { CardPanel } from './CardPanel';
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

    expect(frame.getAttribute('src')).toBe(new URL('sandbox.html', document.baseURI).href);
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('sends the card HTML, with the CardAPI bridge, once the sandbox page is ready', async () => {
    const { hostReady } = await openCard();

    const html = hostReady();

    expect(html).toContain('<p>card</p>');
    expect(html).toContain('window.CardAPI = CardAPI');
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
