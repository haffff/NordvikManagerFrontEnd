import { describe, it, expect } from 'vitest';
import { requestKey, commandKey, findSecrets, buildFixture } from './fixtures';

// A recording is the data channel, in order: what the client sent ('out') and what
// came back ('in'), with timestamps.
const out = (t, msg) => ({ t, dir: 'out', msg });
const inn = (t, msg) => ({ t, dir: 'in', msg });
const req = (id, method, path, query = {}, body = null) => ({ type: 'api-request', id, method, path, query, body });
const res = (id, status, body) => ({ type: 'api-response', id, status, body });

describe('requestKey', () => {
  it('ignores gameid and the order of query parameters', () => {
    expect(requestKey('GET', 'api/map/get', { mapId: 'm1', gameid: 'g1', a: '2' }))
      .toBe(requestKey('get', 'API/MAP/GET', { a: '2', mapid: 'm1' }));
    expect(requestKey('GET', 'api/battlemap/getplayer', { gameid: 'g1' })).toBe('GET api/battlemap/getplayer');
  });
});

describe('commandKey', () => {
  it('keys actions by name and chat commands by their first word', () => {
    expect(commandKey({ command: 'execute_action', data: { action: 'dnd5e/roll', args: {} } })).toBe('execute_action dnd5e/roll');
    expect(commandKey({ command: 'execute_action', data: { Action: 'x/y' } })).toBe('execute_action x/y');
    expect(commandKey({ command: 'chat_push', data: '/help me' })).toBe('chat_push /help');
    expect(commandKey({ command: 'chat_push', data: 'hello' })).toBe('chat_push');
    expect(commandKey({ command: 'client_loaded' })).toBe('client_loaded');
  });
});

describe('findSecrets', () => {
  it('finds credential-looking fields, but not a card property called "token"', () => {
    const data = {
      user: { password: 'x', accessToken: 'abc', refresh_token: 'r' },
      properties: [{ name: 'token', value: 'dnd5e_token_character.json' }],
      element: { tokenData: { size: 1 } },
      empty: { password: '' },
    };
    expect(findSecrets(data).sort()).toEqual(['user.accessToken', 'user.password', 'user.refresh_token']);
  });

  it('also finds email addresses (a GM recording can include the server\'s users)', () => {
    expect(findSecrets({ users: [{ name: 'a', email: 'a@example.com' }, { name: 'b', email: '' }] })).toEqual(['users[0].email']);
  });
});

describe('buildFixture', () => {
  const transcript = [
    out(0, req('1', 'GET', 'api/battlemap/getplayer', { gameid: 'g' })),
    inn(5, res('1', 200, { Id: 'p1' })),
    out(10, req('2', 'GET', 'api/properties/queryproperties', { gameid: 'g', parentIds: 'c1' })),
    inn(15, res('2', 200, [{ id: 'pr1', name: 'hp', value: '7' }])),
    // the same GET again later, after a change: the first answer is the initial state
    out(20, req('3', 'GET', 'api/properties/queryproperties', { gameid: 'g', parentIds: 'c1' })),
    inn(25, res('3', 200, [{ id: 'pr1', name: 'hp', value: '3' }])),
    out(30, { command: 'player_list' }),
    inn(32, { command: 'player_list', data: [{ id: 'p1' }], result: 'Ok' }),
    out(40, { command: 'execute_action', data: { action: 'dnd5e/roll', args: { cardId: 'c1' } } }),
    inn(45, { command: 'execute_action', result: 'Ok' }),
    inn(300, { command: 'chat_push', data: 'rolled 12', isTemplate: false }),
    inn(5000, { command: 'chat_push', data: 'much later, unrelated' }),
    out(6000, req('4', 'POST', 'api/rolls/finish', { gameid: 'g' }, { rollId: 'r' })),
    inn(6010, res('4', 200, null)),
    inn(6020, { command: 'chat_push', data: '{"type":"Html"}', isTemplate: true }),
  ];

  it('keeps the first answer to each GET, keyed without the game id', () => {
    const fixture = buildFixture(transcript, 'gm');
    expect(fixture.role).toBe('gm');
    expect(fixture.version).toBe(1);
    expect(fixture.requests['GET api/battlemap/getplayer']).toEqual({ status: 200, body: { Id: 'p1' } });
    expect(fixture.requests['GET api/properties/queryproperties?parentids=c1'].body[0].value).toBe('7');
  });

  it('remembers what the server sent right after a command or request', () => {
    const fixture = buildFixture(transcript, 'gm');
    expect(fixture.after['player_list']).toEqual([{ command: 'player_list', data: [{ id: 'p1' }], result: 'Ok' }]);
    expect(fixture.after['execute_action dnd5e/roll'].map((m) => m.data ?? null)).toEqual([null, 'rolled 12']);
    expect(fixture.after['POST api/rolls/finish']).toEqual([{ command: 'chat_push', data: '{"type":"Html"}', isTemplate: true }]);
  });

  it('refuses a recording with credentials in it', () => {
    const bad = [out(0, req('1', 'GET', 'api/user/userinfo')), inn(1, res('1', 200, { password: 'hunter2' }))];
    expect(() => buildFixture(bad, 'gm')).toThrow(/password/);
  });
});
