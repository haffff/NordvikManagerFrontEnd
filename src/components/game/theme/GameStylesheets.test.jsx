import { act, render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameStylesheets, PERSONAL_STYLESHEETS_CHANGED } from './GameStylesheets';
import { invalidateCssMaterial, setPersonalStylesheets } from '../../../helpers/customStyles';
import { appliedGameCss } from '../../../helpers/cardAppStyles';

const subscriptions = new Map();
const gameProps = { current: [] };
const cssById = { gm1: '.a{}', gm2: '.b{}', mine: '.c{}' };

vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: {
    getAsync: () => Promise.resolve(gameProps.current),
    getMaterialAsync: (id) => Promise.resolve(new Blob([cssById[id] ?? ''])),
  },
  ActiveTransportManager: {
    Subscribe: (name, cb) => subscriptions.set(name, cb),
    Unsubscribe: (name) => subscriptions.delete(name),
  },
}));

// jsdom has no constructable stylesheets or adoptedStyleSheets.
class FakeSheet {
  cssRules = [];
  replaceSync(text) { this.text = text; this.cssRules = [{ cssText: text }]; }
}

const appliedTexts = () => document.adoptedStyleSheets.map((s) => s.text);
const emit = (event) => act(() => subscriptions.forEach((cb) => cb(event)));

describe('GameStylesheets', () => {
  beforeEach(() => {
    globalThis.CSSStyleSheet = FakeSheet;
    Object.defineProperty(document, 'adoptedStyleSheets', { value: [], writable: true, configurable: true });
    localStorage.clear();
    invalidateCssMaterial();
    subscriptions.clear();
    gameProps.current = [{ id: 'p1', name: 'customStylesheets', value: '["gm1","gm2"]', parentId: 'game-1' }];
  });

  afterEach(() => {
    delete globalThis.CSSStyleSheet;
    delete document.adoptedStyleSheets;
  });

  it("applies the GM's stylesheets in order, then this player's own last", async () => {
    setPersonalStylesheets('game-1', ['mine']);
    render(<GameStylesheets gameId="game-1" />);
    await waitFor(() => expect(appliedTexts()).toEqual(['.a{}', '.b{}', '.c{}']));
  });

  it('follows the GM changing the list and the player changing theirs, keeping other adopted sheets', async () => {
    const other = new FakeSheet();
    document.adoptedStyleSheets = [other];
    render(<GameStylesheets gameId="game-1" />);
    await waitFor(() => expect(appliedTexts()).toEqual([undefined, '.a{}', '.b{}']));

    emit({ command: 'property_update', data: { name: 'customStylesheets', parentId: 'game-1', value: '["gm2"]' } });
    emit({ command: 'property_update', data: { name: 'customStylesheets', parentId: 'other-game', value: '["gm1"]' } });
    await waitFor(() => expect(appliedTexts()).toEqual([undefined, '.b{}']));

    setPersonalStylesheets('game-1', ['mine']);
    act(() => window.dispatchEvent(new Event(PERSONAL_STYLESHEETS_CHANGED)));
    await waitFor(() => expect(appliedTexts()).toEqual([undefined, '.b{}', '.c{}']));
    expect(document.adoptedStyleSheets[0]).toBe(other);
  });

  it('removes its stylesheets when the game closes', async () => {
    const { unmount } = render(<GameStylesheets gameId="game-1" />);
    await waitFor(() => expect(appliedTexts()).toHaveLength(2));
    unmount();
    expect(document.adoptedStyleSheets).toEqual([]);
  });

  it('publishes the CSS it applied, for cards that use the app styles, and clears it when the game closes', async () => {
    setPersonalStylesheets('game-1', ['mine']);
    const { unmount } = render(<GameStylesheets gameId="game-1" />);

    await waitFor(() => expect(appliedGameCss()).toBe(['.a{}', '.b{}', '.c{}'].join('\n')));
    unmount();
    expect(appliedGameCss()).toBe('');
  });
});
