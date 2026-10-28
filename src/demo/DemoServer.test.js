import { describe, it, expect, vi } from 'vitest';
import { DemoServer, rollFormula } from './DemoServer';

// Deterministic dice: always the highest face.
const maxRandom = () => 0.9999;

const fixture = {
  version: 1,
  role: 'player',
  requests: {
    'GET api/battlemap/getplayer': { status: 200, body: { id: 'p1', name: 'Aria' } },
    'GET api/properties/queryproperties?parentids=c1': {
      status: 200,
      body: [
        { id: 'pr1', name: 'hp', value: '7', parentId: 'c1' },
        { id: 'pr2', name: 'weapons', value: '[{"id":"w1","fields":{"name":"Axe"}}]', parentId: 'c1' },
      ],
    },
  },
  after: {
    player_list: [{ command: 'player_list', data: [{ id: 'p1' }], result: 'Ok' }],
    'execute_action dnd5e/roll': [{ command: 'chat_push', data: 'Strength check: 15', playerId: 'p1' }],
    'chat_push /help': [{ command: 'chat_push', data: 'Commands: /r …', onlyToSender: true }],
  },
};

const req = (method, path, query = {}, body = null) => ({ type: 'api-request', id: 'x', method, path, query, body });
const server = (opts) => new DemoServer(fixture, { random: maxRandom, ...opts });

describe('rollFormula', () => {
  it('rolls dice plus modifiers', () => {
    const roll = rollFormula('2d6+3', maxRandom);
    expect(roll.result).toBe(15);
    expect(roll.rolled).toBe('2d6+3');
    expect(roll.dices).toEqual([
      { index: 0, diceValue: 6, times: 1, result: 6, kept: true },
      { index: 1, diceValue: 6, times: 1, result: 6, kept: true },
    ]);
  });

  it('keeps the highest or lowest (advantage, disadvantage)', () => {
    let n = 0;
    const seq = () => [0.0, 0.9999][n++ % 2]; // 1, then 20
    expect(rollFormula('2d20kh1+5', seq).result).toBe(25);
    n = 0;
    const low = rollFormula('2d20kl1', seq);
    expect(low.result).toBe(1);
    expect(low.dices.map((d) => d.kept)).toEqual([true, false]);
  });

  it('returns null for what it does not understand', () => {
    expect(rollFormula('fireball', maxRandom)).toBeNull();
    expect(rollFormula('4dF', maxRandom)).toBeNull();
  });
});

describe('DemoServer.request', () => {
  it('answers from the fixture, ignoring the game id, with a fresh copy each time', () => {
    const s = server();
    const a = s.request(req('GET', 'api/battlemap/getplayer', { gameid: 'g' }));
    expect(a).toEqual({ status: 200, body: { id: 'p1', name: 'Aria' }, broadcasts: [] });
    a.body.name = 'changed';
    expect(s.request(req('GET', 'api/battlemap/getplayer')).body.name).toBe('Aria');
  });

  it('answers 404 for anything not recorded, and notes it once', () => {
    const onNote = vi.fn();
    const s = server({ onNote });
    expect(s.request(req('GET', 'api/addon/repository')).status).toBe(404);
    s.request(req('GET', 'api/addon/repository'));
    expect(onNote).toHaveBeenCalledTimes(1);
    // Fetched by the app itself: quiet. Something the visitor did: not.
    expect(onNote).toHaveBeenLastCalledWith(expect.any(String), { quiet: true });
    s.request(req('POST', 'api/addon/install', {}, {}));
    expect(onNote).toHaveBeenLastCalledWith(expect.any(String), { quiet: false });
  });

  it('answers property queries from the fixture\'s property list when that query is not recorded', () => {
    const s = new DemoServer({
      requests: {},
      after: {},
      properties: [
        { id: 'a1', name: 'note_text', value: 'hi', parentId: 'c1' },
        { id: 'a2', name: 'app_styles', value: 'true', parentId: 'c1' },
        { id: 'b1', name: 'note_text', value: 'other', parentId: 'c2' },
      ],
    });
    const query = (q) => s.request(req('GET', 'api/properties/queryproperties', { gameid: 'g', ...q }));
    expect(query({ parentIds: 'c1' }).body.map((p) => p.id)).toEqual(['a1', 'a2']);
    expect(query({ parentIds: 'c1,c2', names: 'note_text' }).body.map((p) => p.id)).toEqual(['a1', 'b1']);
    expect(query({ parentIds: 'c3' })).toMatchObject({ status: 200, body: [] });

    // changes made during the visit show up too
    s.command({ command: 'property_update', data: { id: 'a1', value: 'edited' } });
    expect(query({ parentIds: 'c1', names: 'note_text' }).body).toEqual([{ id: 'a1', name: 'note_text', value: 'edited', parentId: 'c1' }]);
  });

  it('serves files from the fixture\'s resources by id or key, thumbnails included', () => {
    const s = new DemoServer({
      requests: {},
      after: {},
      resources: [{ id: 'r1', key: 'map_bg', name: 'bg.svg', mimeType: 'image/svg+xml', data: 'PHN2Zz4=' }],
    });
    const get = (q) => s.request(req('GET', 'api/materials/resource', { gameid: 'g', ...q }));
    expect(get({ id: 'r1' })).toMatchObject({ status: 200, body: { data: 'PHN2Zz4=', mimeType: 'image/svg+xml' } });
    expect(get({ key: 'map_bg', thumbnail: 'true' }).body.data).toBe('PHN2Zz4=');
    expect(get({ id: 'nope' }).status).toBe(404);
  });

  it('rolls for cards: rolls/start, then rolls/finish', () => {
    const s = server();
    const start = s.request(req('POST', 'api/rolls/start', {}, { formulas: [{ key: 'atk', formula: '1d20+5' }] }));
    expect(start.status).toBe(200);
    expect(start.body.results).toEqual([{ key: 'atk', roll: expect.objectContaining({ result: 25 }) }]);
    expect(s.request(req('POST', 'api/rolls/finish', {}, { rollId: start.body.rollId, html: '<b></b>' })).status).toBe(200);
    expect(s.request(req('POST', 'api/rolls/finish', {}, { rollId: 'nope', html: '' })).status).toBe(404);
  });
});

describe('DemoServer.command', () => {
  it('echoes a property change and remembers it for later reads', () => {
    const s = server();
    const out = s.command({ command: 'property_update', data: { id: 'pr1', name: 'hp', value: '3', parentId: 'c1' } });
    expect(out).toEqual([{ command: 'property_update', data: { id: 'pr1', name: 'hp', value: '3', parentId: 'c1' }, result: 'Ok' }]);
    const read = s.request(req('GET', 'api/properties/queryproperties', { parentIds: 'c1' }));
    expect(read.body.find((p) => p.id === 'pr1').value).toBe('3');
  });

  it('gives added things an id, and later reads include added properties and leave out removed ones', () => {
    const s = server();
    const [added] = s.command({ command: 'property_add', data: { name: 'ac', value: '15', parentId: 'c1' } });
    expect(added.data.id).toBeTruthy();
    s.command({ command: 'property_remove', data: 'pr2' });
    const names = s.request(req('GET', 'api/properties/queryproperties', { parentIds: 'c1' })).body.map((p) => p.name);
    expect(names).toEqual(['hp', 'ac']);

    const [element] = s.command({ command: 'element_add', data: { object: { left: 1 } } });
    expect(element.data.id).toBeTruthy();
    expect(element.result).toBe('Ok');
  });

  it('turns list-row changes into a property_update with the new value, like the server', () => {
    const s = server();
    const [out] = s.command({ command: 'property_list_item_add', data: { propertyId: 'pr2', fields: { name: 'Bow' }, itemId: 'w2' } });
    expect(out.command).toBe('property_update');
    expect(JSON.parse(out.data.value)).toEqual([
      { id: 'w1', fields: { name: 'Axe' } },
      { id: 'w2', fields: { name: 'Bow' } },
    ]);
    const [removed] = s.command({ command: 'property_list_item_remove', data: { propertyId: 'pr2', itemId: 'w1' } });
    expect(JSON.parse(removed.data.value)).toEqual([{ id: 'w2', fields: { name: 'Bow' } }]);
  });

  it('posts chat as the current player, and rolls /r locally', () => {
    const s = server();
    expect(s.command({ command: 'chat_push', data: 'hello' })).toEqual([
      { command: 'chat_push', data: 'hello', playerId: 'p1', result: 'Ok' },
    ]);
    const [roll] = s.command({ command: 'chat_push', data: '/r 1d20+2' });
    expect(roll.isTemplate).toBe(true);
    expect(roll.playerId).toBe('p1');
    const template = JSON.parse(roll.data);
    expect(template).toMatchObject({ type: 'Roll', title: 'Roll', message: 'Roll', roll: { result: 22, rolled: '1d20+2' } });
  });

  it('replays recorded answers: other chat commands, queries and actions', () => {
    const s = server();
    expect(s.command({ command: 'chat_push', data: '/help' })[0].data).toBe('Commands: /r …');
    expect(s.command({ command: 'player_list' })).toEqual(fixture.after.player_list);
    expect(s.command({ command: 'execute_action', data: { action: 'dnd5e/roll', args: {} } })[0].data).toBe('Strength check: 15');
  });

  it('notes what it cannot do instead of breaking', () => {
    const onNote = vi.fn();
    const s = server({ onNote });
    expect(s.command({ command: 'execute_action', data: { action: 'unknown/thing' } })).toEqual([]);
    expect(onNote).toHaveBeenCalledWith(expect.stringMatching(/actions run on the GM/i), { quiet: false });
    expect(s.command({ command: 'debug_mode_set', data: true })).toEqual([]);
  });
});
