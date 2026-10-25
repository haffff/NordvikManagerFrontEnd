import { describe, it, expect, vi } from 'vitest';
import { showToPlayersItems, panelForPlayers } from './showToPlayers';

const CardPanel = () => null;
const ActionsPanel = () => null;
const Battlemap = () => null;
const keys = new Map([[CardPanel, 'CardPanel'], [ActionsPanel, 'ActionsPanel'], [Battlemap, 'Battlemap']]);
const resolveKey = (type) => keys.get(type);

const content = (type, props, contentId = 7) => ({ contentId, title: 'x', element: { type, props } });
const ref = { current: {} };

describe('panelForPlayers', () => {
  it('describes a card panel by its type and serializable props', () => {
    const panel = panelForPlayers(content(CardPanel, { cardId: 'c1', gameDataManagerRef: ref, onClose: () => {}, state: { ref: {} } }), {}, resolveKey);
    expect(panel).toEqual({ type: 'CardPanel', props: { cardId: 'c1' } });
  });

  it('describes a battle map by the battle map it shows, as the map\'s own Show does', () => {
    const battleMaps = { a: { id: 'bm1', PanelContentID: 7 } };
    expect(panelForPlayers(content(Battlemap, { withID: 'bm1' }), battleMaps, resolveKey)).toEqual({ type: 'Battlemap', syncId: 'bm1' });
  });

  it('has nothing for GM-only panels, unknown ones, or a battle map not loaded yet', () => {
    expect(panelForPlayers(content(ActionsPanel, {}), {}, resolveKey)).toBeNull();
    expect(panelForPlayers(content(() => null, {}), {}, resolveKey)).toBeNull();
    expect(panelForPlayers(content(Battlemap, {}), {}, resolveKey)).toBeNull();
    expect(panelForPlayers(undefined, {}, resolveKey)).toBeNull();
  });
});

describe('showToPlayersItems', () => {
  it('offers "Show to players" to GMs and sends show_panel with the panel', () => {
    const send = vi.fn();
    const items = showToPlayersItems(content(CardPanel, { cardId: 'c1' }), { canEditGame: true, battleMaps: {}, resolveKey, send });

    expect(items.map((i) => i.label)).toEqual(['Show to players']);
    items[0].onClick();
    expect(send).toHaveBeenCalledWith({ command: 'show_panel', data: { type: 'CardPanel', props: { cardId: 'c1' } } });
  });

  it('offers nothing to players, or for panels players have no use for', () => {
    const send = vi.fn();
    expect(showToPlayersItems(content(CardPanel, { cardId: 'c1' }), { canEditGame: false, battleMaps: {}, resolveKey, send })).toEqual([]);
    expect(showToPlayersItems(content(ActionsPanel, {}), { canEditGame: true, battleMaps: {}, resolveKey, send })).toEqual([]);
  });
});
