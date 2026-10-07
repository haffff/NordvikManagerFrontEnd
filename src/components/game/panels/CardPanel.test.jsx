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

// jsdom can't load blob: URLs; keep what the card page would have been.
let pageHtml;
const decode = (href) => new TextDecoder().decode(Uint8Array.from(atob(href.split(',')[1]), (c) => c.charCodeAt(0)));
const linkHref = (html, id) => html.match(new RegExp(`id="${id}" href="([^"]+)"`))?.[1];

describe('CardPanel, app styles', () => {
  beforeEach(() => {
    pageHtml = null;
    server.appStyles = undefined;
    setAppliedGameCss('.nm_basePanel { color: gold; }');
    URL.createObjectURL = vi.fn((blob) => {
      const reader = new FileReader();
      reader.onload = () => { pageHtml = reader.result; };
      reader.readAsText(blob);
      return 'blob:card';
    });
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => setAppliedGameCss(''));

  it('a card whose template opts in gets the app base before its CSS and the theme after', async () => {
    server.appStyles = 'true';
    render(<CardPanel id="card-1" name="Note" />);

    await waitFor(() => expect(pageHtml).toBeTruthy());
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
    render(<CardPanel id="card-1" name="Sheet" />);

    await waitFor(() => expect(pageHtml).toBeTruthy());
    expect(pageHtml).not.toContain('id="nm-app-base"');
    expect(pageHtml).not.toContain('id="nm-app-theme"');
    expect(pageHtml).toContain(`base64,${b64('.card{}')}`);
  });

  it("an opted-in card is sent the new styles when the game's theme changes", async () => {
    server.appStyles = 'true';
    const { container } = render(<CardPanel id="card-1" name="Note" />);
    await waitFor(() => expect(pageHtml).toBeTruthy());
    const frame = container.querySelector('iframe');
    const posted = vi.spyOn(frame.contentWindow, 'postMessage');
    // the page says it's ready, so messages are no longer queued
    act(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'SANDBOX_READY' }, source: frame.contentWindow })));

    act(() => setAppliedGameCss('.nm_basePanel { color: teal; }'));

    expect(posted).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'APP_STYLES', theme: '.nm_basePanel { color: teal; }', base: expect.stringContaining('.nm_basePanel') }),
      '*',
    );
  });
});
