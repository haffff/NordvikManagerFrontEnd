import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const { server, dock } = vi.hoisted(() => ({
  server: { appStyles: undefined, cardName: undefined },
  dock: { layoutContent: null, calls: [], titles: [] },
}));

vi.mock('@hlorenzi/react-dockable', () => ({
  useContentContext: () => ({ setTitle: (title) => dock.titles.push(title), layoutContent: dock.layoutContent }),
  removeContent: vi.fn((...args) => dock.calls.push(['removeContent', ...args])),
  coallesceEmptyPanels: vi.fn((...args) => dock.calls.push(['coallesceEmptyPanels', ...args])),
}));
vi.mock('../../uiComponents/base/BasePanel', () => ({ BasePanel: ({ children }) => <div>{children}</div> }));
vi.mock('../../uiComponents/hooks/useUUID', () => ({ default: () => 'panel-1' }));
vi.mock('../../../helpers/DockableHelper', () => ({ default: { getGlobalState: vi.fn() } }));
// The host-side CardAPI this card's frame talks to (tests set the methods they need).
const cardApi = vi.hoisted(() => ({}));
vi.mock('../../../CardAPI', () => ({
  default: async () => cardApi,
  ALLOWED_WS_RECEIVE_PREFIXES: ['property_', 'chat_', 'custom_'],
  ALLOWED_WS_COMMANDS: { chat_push: true, execute_action: true },
}));
const b64 = (text) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));
vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: {
    ApiAddress: 'https://gm.example/api',
    getAsync: vi.fn(async (path) => {
      if (path.startsWith('materials/getcard')) return { name: server.cardName, mainResource: 'main', additionalResources: ['css1'] };
      if (path.startsWith('properties/QueryProperties')) {
        return server.appStyles === undefined ? [] : [{ name: 'app_styles', value: server.appStyles }];
      }
      if (path === 'materials/ResourceMetadata?id=main') {
        return { mimeType: 'text/html', data: b64('<html><head></head><body><p>card</p><p>Zażółć gęślą jaźń</p></body></html>') };
      }
      if (path === 'materials/ResourceMetadata?id=css1') return { mimeType: 'text/css', data: b64('.card{}') };
      if (path === 'security/sandboxorigins') return { origins: ['https://cdn.example.com'] };
      return null;
    }),
  },
  ActiveTransportManager: { Subscribe: vi.fn(), Unsubscribe: vi.fn(), Send: vi.fn() },
}));

import { CardPanel } from './CardPanel';
import { beforeEach as beforeEachTest } from 'vitest';

beforeEachTest(() => {
  for (const key of Object.keys(cardApi)) delete cardApi[key];
  Object.assign(cardApi, {
    destroy: vi.fn(),
    FireAction: vi.fn(),
    SendCustomCommandToServer: vi.fn(),
    ClientMediator: { sendCommandAsync: vi.fn(async () => 'game-1'), register: vi.fn(() => 'addon_card-1_t'), unregister: vi.fn(() => true) },
  });
});
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

// A view opened by an action (ShowView, view_show) gets only the card's id and data: the
// window is titled with the card's own name instead of the dock's "Content N".
describe('CardPanel, window title', () => {
  beforeEach(() => { dock.titles.length = 0; server.cardName = undefined; });

  it('uses the name it is opened with', async () => {
    server.cardName = 'Stored name';
    render(<CardPanel id="card-1" name="Goblin" />);
    await waitFor(() => expect(dock.titles.at(-1)).toBe('Goblin'));
  });

  it('without one, uses the name of the card once it is loaded', async () => {
    server.cardName = 'Postać hafo - Horst "Klekot"';
    render(<CardPanel id="card-1" data='{"view":"viewer"}' />);
    await waitFor(() => expect(dock.titles.at(-1)).toBe('Postać hafo - Horst "Klekot"'));
    expect(dock.titles.every((t) => !t || !/^Content/.test(t))).toBe(true);
  });
});

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

describe('CardPanel, card HTML', () => {
  // The main resource is UTF-8; decoding it as Latin-1 turned non-ASCII text to mojibake.
  it('decodes the card page as UTF-8', async () => {
    expect((await openCard()).hostReady()).toContain('Zażółć gęślą jaźń');
  });
});

describe('CardPanel, calls from the card', () => {
  const ready = async () => {
    const card = await openCard();
    card.hostReady();
    card.fromFrame({ type: 'SANDBOX_READY' });
    const sent = (type) => card.posted.mock.calls.map(([m]) => m).filter((m) => m.type === type);
    return { ...card, sent };
  };

  it('hands ClientMediator calls to the CardAPI allowlist', async () => {
    const { fromFrame, sent } = await ready();

    fromFrame({ type: 'CMD', reqId: 'r1', panel: '__mediator__', command: 'Game', data: { command: 'GetGameId', data: { x: 1 } } });

    await waitFor(() => expect(sent('CMD_RESULT').find((m) => m.reqId === 'r1')).toMatchObject({ result: 'game-1' }));
    expect(cardApi.ClientMediator.sendCommandAsync).toHaveBeenCalledWith('Game', 'GetGameId', { x: 1 });
  });

  it('reports a refused call as an error', async () => {
    cardApi.ClientMediator.sendCommandAsync.mockRejectedValue(new Error('CardAPI: "Game.DeleteGame" is not available to cards'));
    const { fromFrame, sent } = await ready();

    fromFrame({ type: 'CMD', reqId: 'r2', panel: '__mediator__', command: 'Game', data: { command: 'DeleteGame' } });

    await waitFor(() => expect(sent('CMD_RESULT').find((m) => m.reqId === 'r2')?.error).toContain('not available to cards'));
  });

  it('forwards calls to a panel the card registered into the frame, and returns its answer', async () => {
    const { fromFrame, sent } = await ready();

    fromFrame({ type: 'CMD', reqId: 'r3', panel: '__register__', command: 'addon_t', data: { commands: ['Next'] } });
    await waitFor(() => expect(sent('CMD_RESULT').find((m) => m.reqId === 'r3')).toMatchObject({ result: 'addon_card-1_t' }));
    const [name, commands, invoke] = cardApi.ClientMediator.register.mock.calls[0];
    expect([name, commands]).toEqual(['addon_t', ['Next']]);

    const answer = invoke('addon_t', 'Next', { by: 2 });
    const call = sent('MEDIATOR_CALL').at(-1);
    expect(call).toMatchObject({ name: 'addon_t', command: 'Next', data: { by: 2 } });
    fromFrame({ type: 'MEDIATOR_RESULT', reqId: call.reqId, result: 4 });
    expect(await answer).toBe(4);
  });

  it('accepts an action as { action, args } or { Action, Args }', async () => {
    const { fromFrame } = await ready();

    fromFrame({ type: 'WS_SEND', command: 'execute_action', data: { action: 'dnd5e/a', args: { x: 1 } } });
    fromFrame({ type: 'WS_SEND', command: 'execute_action', data: { Action: 'dnd5e/b', Args: { y: 2 } } });

    expect(cardApi.FireAction).toHaveBeenNthCalledWith(1, 'dnd5e/a', { x: 1 });
    expect(cardApi.FireAction).toHaveBeenNthCalledWith(2, 'dnd5e/b', { y: 2 });
  });
});
