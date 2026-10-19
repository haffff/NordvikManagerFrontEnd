import { describe, it, expect } from 'vitest';
import { buildMockFixture, MOCK_IDS, toBase64 } from './mockGame';
import { requestKey, findSecrets } from './fixtures';
import { PanelList } from '../helpers/PanelsList';

const get = (fixture, path, query) => fixture.requests[requestKey('GET', path, query)];
const layoutOf = (fixture) => JSON.parse(get(fixture, 'api/battlemap/getfullgame').body.defaultLayout.value);
const fromBase64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));

describe.each(['gm', 'player'])('the mock game (%s view)', (role) => {
  const fixture = buildMockFixture(role);

  it('is a fixture like a recorded one, with no credentials in it', () => {
    expect(fixture).toMatchObject({ version: 1, role, requests: expect.any(Object), after: expect.any(Object) });
    expect(findSecrets(fixture)).toEqual([]);
  });

  it('the visitor is the GM or Aria', () => {
    const player = get(fixture, 'api/battlemap/getplayer').body;
    const game = get(fixture, 'api/battlemap/getfullgame').body;
    expect(player.id).toBe(role === 'gm' ? MOCK_IDS.gm : MOCK_IDS.player);
    expect(game.master.id).toBe(MOCK_IDS.gm);
    expect(game.players.map((p) => p.id)).toContain(player.id);
  });

  it('has a default layout made of real panels, the tour\'s among them', () => {
    const layout = layoutOf(fixture);
    const types = layout._contents.map((c) => c.type);
    types.forEach((type) => expect(PanelList).toHaveProperty(type));
    expect(types).toEqual(expect.arrayContaining(['Battlemap', 'ToolsPanel', 'ChatPanel', 'DiceRollerPanel', 'CardsPanel', 'TurnOrderPanel', 'PlayersPanel']));

    // every content id in the tree has a content entry, and the other way round
    const used = [];
    const walk = (panel) => { used.push(...(panel.contentList ?? [])); (panel.splitPanels ?? []).forEach(walk); };
    walk(layout);
    expect(used.sort()).toEqual(layout._contents.map((c) => c.contentId).sort());
  });

  it('the layout\'s map is the game\'s battle map, and both are answered', () => {
    const game = get(fixture, 'api/battlemap/getfullgame').body;
    const map = layoutOf(fixture)._contents.find((c) => c.type === 'Battlemap');
    expect(game.battleMaps.map((b) => b.id)).toEqual([map.syncId]);
    expect(map.props.withID).toBe(map.syncId);

    const battleMap = get(fixture, 'api/battlemap/getbattlemap', { id: map.syncId }).body;
    expect(battleMap.mapId).toBe(map.mapId);
    const mapBody = get(fixture, 'api/map/get', { mapId: map.mapId }).body;
    expect(mapBody.id).toBe(map.mapId);
    expect(mapBody.elements.length).toBeGreaterThan(0);
    mapBody.elements.forEach((e) => expect(() => JSON.parse(e.object)).not.toThrow());
    expect(get(fixture, 'api/turnorder', { mapId: map.mapId }).body.entries.length).toBeGreaterThan(0);
  });

  it('every card it lists opens: the card, its Note template files, decoded as UTF-8', () => {
    const cards = get(fixture, 'api/materials/getcards').body;
    expect(cards.length).toBeGreaterThan(1);
    for (const { id } of cards) {
      const card = get(fixture, 'api/materials/getcard', { id }).body;
      expect(card.id).toBe(id);
      const main = get(fixture, 'api/materials/resourcemetadata', { id: card.mainResource }).body;
      expect(fromBase64(main.data)).toContain('Write your note here…');
      card.additionalResources.forEach((res) => {
        expect(get(fixture, 'api/materials/resourcemetadata', { id: res })?.body?.data).toBeTruthy();
      });
      expect(fixture.properties.some((p) => p.parentId === id && p.name === 'note_text')).toBe(true);
    }
  });

  it('the visitor sees only the cards they could see in a real game', () => {
    const ids = get(fixture, 'api/materials/getcards').body.map((c) => c.id);
    if (role === 'gm') expect(ids).toEqual(expect.arrayContaining([MOCK_IDS.cards.gmNotes, MOCK_IDS.cards.ariaNotes]));
    else {
      expect(ids).toContain(MOCK_IDS.cards.ariaNotes);
      expect(ids).not.toContain(MOCK_IDS.cards.gmNotes);
    }
  });
});

describe('the mock game, GM windows', () => {
  const fixture = buildMockFixture('gm');
  const targetsOf = (entryType) => get(fixture, 'api/battlemap/gettree', { entityType: entryType }).body
    .filter((e) => !e.isFolder).map((e) => e.targetId);

  it('every material, playlist and soundboard in a list has a tree entry that points at it', () => {
    const materials = get(fixture, 'api/materials/getresources').body.map((r) => r.id);
    expect(targetsOf('ResourceModel').sort()).toEqual([...materials].sort());
    expect(targetsOf('Playlist')).toEqual(get(fixture, 'api/playlist/getplaylists', { kind: '0' }).body.map((p) => p.id));
    expect(targetsOf('Soundboard')).toEqual(get(fixture, 'api/playlist/getplaylists', { kind: '1' }).body.map((p) => p.id));
    expect(targetsOf('CardModel').sort()).toEqual(get(fixture, 'api/materials/getcards').body.map((c) => c.id).sort());
  });

  it('pictures in the materials have their files, and the map floor uses one', () => {
    const images = get(fixture, 'api/materials/getresources').body.filter((r) => r.mimeType.startsWith('image/'));
    images.forEach((r) => expect(fixture.resources.find((f) => f.id === r.id)?.data).toBeTruthy());
    const map = get(fixture, 'api/map/get', { mapId: MOCK_IDS.map }).body;
    const floor = map.elements.find((e) => e.id === MOCK_IDS.elements.floor);
    expect(images.map((r) => r.id)).toContain(JSON.parse(floor.object).resourceId);
  });

  it('the action uses only steps it has definitions for', () => {
    const defs = get(fixture, 'api/addon/stepdefinitions').body.stepDefinitions.map((d) => d.value);
    const [listed] = get(fixture, 'api/addon/actions').body;
    JSON.parse(get(fixture, 'api/addon/action', { id: listed.id }).body.content).forEach((step) => expect(defs).toContain(step.Type));
  });

  it('players get none of it', () => {
    const player = buildMockFixture('player');
    expect(get(player, 'api/materials/getresources').body).toEqual([]);
    expect(get(player, 'api/addon/installed')).toBeUndefined();
  });
});

describe('toBase64', () => {
  it('encodes UTF-8 text, also large', () => {
    expect(fromBase64(toBase64('Zażółć … ✓'))).toBe('Zażółć … ✓');
    const big = 'x'.repeat(300000);
    expect(fromBase64(toBase64(big))).toBe(big);
  });
});
