import { vi, describe, it, expect, beforeEach } from 'vitest';

// Regression coverage for the parentId casing bug this session — CardAPI.js used to
// read data.parentID (capital ID) in one round and both CardAPI.js + PropertiesManager
// broke live property updates entirely in another, because the server broadcast the
// same logical field under different casings depending on what triggered the change.
// The backend now always sends "parentId" (see PropertyDTO.cs's explicit
// [JsonProperty]/[JsonPropertyName] overrides), so these tests pin that contract from
// the client side.

vi.mock('./helpers/transport', () => ({
  ActiveTransportManager: {
    Subscribe: vi.fn(),
    Unsubscribe: vi.fn(),
    Send: vi.fn(),
  },
  ActiveWebHelper: {
    getAsync: vi.fn(),
    postAsync: vi.fn(),
    uploadInPieces: vi.fn(),
  },
}));

vi.mock('./helpers/ResourceCache', () => ({
  default: { get: vi.fn(), put: vi.fn() },
}));

import { ActiveTransportManager, ActiveWebHelper } from './helpers/transport';
import ResourceCache from './helpers/ResourceCache';
import CardAPIFactory, { PropertiesManagerInstance } from './CardAPI';

function subscribedCallback(prefix) {
  const call = ActiveTransportManager.Subscribe.mock.calls.find(([key]) => key.startsWith(prefix));
  if (!call) throw new Error(`No Subscribe call found for prefix "${prefix}"`);
  return call[1];
}

// PropertiesManagerInstance is a module-level singleton — its Subscribe call happens
// exactly once, at import time, before any test's beforeEach(mockClear) runs. Capture
// it immediately so later mockClear() calls (needed for the CardAPI-instance tests
// below, which create a fresh Subscribe call per test) don't erase this one.
const propertiesManagerCallback = subscribedCallback('PropertiesManager_subs');

describe('CardAPI — _handleWebSocketMessage property routing', () => {
  const CARD_ID = 'card-aaaa';

  beforeEach(() => {
    ActiveTransportManager.Subscribe.mockClear();
    ActiveWebHelper.getAsync.mockReset().mockResolvedValue([]);
  });

  async function makeApi() {
    const api = await CardAPIFactory(CARD_ID);
    return { api, onMessage: subscribedCallback('CardAPI_') };
  }

  it('updates the cache and notifies subscribers when parentId matches this card', async () => {
    const { api, onMessage } = await makeApi();
    const received = vi.fn();
    api.Properties.Subscribe('strength_attribute', received);

    onMessage({
      command: 'property_update',
      data: { id: 'p1', name: 'strength_attribute', value: '18', parentId: CARD_ID },
    });

    expect(received).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'strength_attribute', value: '18' })
    );
  });

  it('ignores property_update when parentId belongs to a different card', async () => {
    const { api, onMessage } = await makeApi();
    const received = vi.fn();
    api.Properties.Subscribe('strength_attribute', received);

    onMessage({
      command: 'property_update',
      data: { id: 'p1', name: 'strength_attribute', value: '18', parentId: 'some-other-card' },
    });

    expect(received).not.toHaveBeenCalled();
  });

  it('does not match on a stray parentID (capital ID) field', async () => {
    // Guards against regressing back to the old capital-ID casing bug: a payload that
    // only has parentID (not parentId) must be treated as not belonging to this card,
    // since the real server contract is exclusively lowercase "parentId" now.
    const { api, onMessage } = await makeApi();
    const received = vi.fn();
    api.Properties.Subscribe('strength_attribute', received);

    onMessage({
      command: 'property_update',
      data: { id: 'p1', name: 'strength_attribute', value: '18', parentID: CARD_ID },
    });

    expect(received).not.toHaveBeenCalled();
  });

  it('removes the cached property and notifies with null on property_remove', async () => {
    const { api, onMessage } = await makeApi();
    onMessage({
      command: 'property_add',
      data: { id: 'p1', name: 'strength_attribute', value: '18', parentId: CARD_ID },
    });

    const received = vi.fn();
    api.Properties.Subscribe('strength_attribute', received);

    onMessage({
      command: 'property_remove',
      data: { id: 'p1', name: 'strength_attribute', parentId: CARD_ID },
    });

    expect(received).toHaveBeenCalledWith(null);
  });
});

describe('PropertiesManager — cache invalidation on property_remove', () => {
  beforeEach(() => {
    for (const key of Object.keys(PropertiesManagerInstance._propertyCache)) {
      delete PropertiesManagerInstance._propertyCache[key];
    }
  });

  it('caches by id on property_add/property_update', () => {
    propertiesManagerCallback({ command: 'property_add', data: { id: 'p1', name: 'x', parentId: 'card-1' } });

    expect(PropertiesManagerInstance._propertyCache['p1']).toEqual(
      expect.objectContaining({ name: 'x', parentId: 'card-1' })
    );
  });

  it('deletes by data.id (full DTO), not the whole data object, on property_remove', () => {
    // Regression: the server used to broadcast a bare property-ID string for removes,
    // and the old code did `delete this._propertyCache[command.data]`. It now sends a
    // full PropertyDTO, so the cache key must be read from data.id.
    propertiesManagerCallback({ command: 'property_add', data: { id: 'p1', name: 'x', parentId: 'card-1' } });
    expect(PropertiesManagerInstance._propertyCache['p1']).toBeDefined();

    propertiesManagerCallback({ command: 'property_remove', data: { id: 'p1', name: 'x', parentId: 'card-1' } });
    expect(PropertiesManagerInstance._propertyCache['p1']).toBeUndefined();
  });
});

describe('PropertiesManager — GetByNames / GetByPrefix cache lookups by parentId', () => {
  beforeEach(() => {
    for (const key of Object.keys(PropertiesManagerInstance._propertyCache)) {
      delete PropertiesManagerInstance._propertyCache[key];
    }
    ActiveWebHelper.getAsync.mockReset();
  });

  it('GetByNames finds a cached property via parentId (not parentID)', async () => {
    PropertiesManagerInstance._propertyCache['p1'] = {
      id: 'p1', name: 'token', value: 'img.png', parentId: 'card-1',
    };

    const result = await PropertiesManagerInstance.GetByNames({ parentId: 'card-1', names: 'token' });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
    expect(ActiveWebHelper.getAsync).not.toHaveBeenCalled();
  });

  it('GetByPrefix filters cached properties via parentId', async () => {
    PropertiesManagerInstance._propertyCache['p1'] = {
      id: 'p1', name: 'dnd5e_ability_str', value: '18', parentId: 'card-1',
    };
    PropertiesManagerInstance._propertyCache['p2'] = {
      id: 'p2', name: 'dnd5e_ability_dex', value: '14', parentId: 'card-2',
    };

    const result = await PropertiesManagerInstance.GetByPrefix({
      parentId: 'card-1', prefix: 'dnd5e_ability_', getFromCache: true,
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });
});

describe('PropertiesManager — bulk saves rely on the server broadcast', () => {
  beforeEach(() => {
    for (const key of Object.keys(PropertiesManagerInstance._propertyCache)) {
      delete PropertiesManagerInstance._propertyCache[key];
    }
    ActiveWebHelper.postAsync.mockReset().mockResolvedValue({ status: 200, body: { result: 0 } });
    ActiveTransportManager.Send.mockClear();
  });

  it('AddMany posts to the AddBulk route and sends no property_notify', async () => {
    const properties = [{ parentId: 'card-1', name: 'hp', value: '10' }];
    await PropertiesManagerInstance.AddMany({ properties });
    expect(ActiveWebHelper.postAsync).toHaveBeenCalledWith('properties/AddBulk', properties);
    expect(ActiveTransportManager.Send).not.toHaveBeenCalled();
    expect(PropertiesManagerInstance._propertyCache).not.toHaveProperty('undefined');
  });

  it('UpdateBulk posts to the UpdateBulk route and sends no property_notify', async () => {
    const properties = [{ id: 'p1', parentId: 'card-1', name: 'hp', value: '12' }];
    await PropertiesManagerInstance.UpdateBulk({ properties });
    expect(ActiveWebHelper.postAsync).toHaveBeenCalledWith('properties/UpdateBulk', properties);
    expect(ActiveTransportManager.Send).not.toHaveBeenCalled();
  });
});

describe('CardAPI — Rolls (roll now, post later)', () => {
  beforeEach(() => {
    ActiveTransportManager.Subscribe.mockClear();
    ActiveWebHelper.getAsync.mockReset().mockResolvedValue([]);
    ActiveWebHelper.postAsync.mockReset();
  });

  it('Start sends the whole batch in one request and resolves to the server-held results', async () => {
    const api = await CardAPIFactory('card-rolls');
    const body = { rollId: 'r1', results: [{ key: 'result', roll: { result: 58 } }] };
    ActiveWebHelper.postAsync.mockResolvedValue({ status: 200, body });

    const formulas = [{ key: 'result', formula: '1d100' }, { key: 'sl', formula: '0' }];
    await expect(api.Rolls.Start(formulas)).resolves.toEqual(body);
    expect(ActiveWebHelper.postAsync).toHaveBeenCalledTimes(1);
    expect(ActiveWebHelper.postAsync).toHaveBeenCalledWith('rolls/start', { formulas });
  });

  it('Start rejects with the server error message for an invalid formula', async () => {
    const api = await CardAPIFactory('card-rolls');
    ActiveWebHelper.postAsync.mockResolvedValue({ status: 400, body: { error: "Invalid roll formula for 'result': 1d" } });

    await expect(api.Rolls.Start([{ key: 'result', formula: '1d' }])).rejects.toThrow("Invalid roll formula for 'result': 1d");
  });

  it('Finish posts only the roll id, html, css key and title — never roll numbers', async () => {
    const api = await CardAPIFactory('card-rolls');
    ActiveWebHelper.postAsync.mockResolvedValue({ status: 200, body: null });

    await api.Rolls.Finish({ rollId: 'r1', html: '<b data-roll-key="result"></b>', cssResourceKey: 'css', title: 'Test', results: [{ key: 'result', roll: { result: 1 } }] });
    expect(ActiveWebHelper.postAsync).toHaveBeenCalledWith('rolls/finish', {
      rollId: 'r1', html: '<b data-roll-key="result"></b>', cssResourceKey: 'css', title: 'Test',
    });
  });

  it('Finish rejects for an unknown or expired roll', async () => {
    const api = await CardAPIFactory('card-rolls');
    ActiveWebHelper.postAsync.mockResolvedValue({ status: 404, body: { error: 'Unknown or expired roll.' } });

    await expect(api.Rolls.Finish({ rollId: 'gone', html: '<p></p>' })).rejects.toThrow('Unknown or expired roll.');
  });
});

describe('CardAPI — turn order', () => {
  it('cards may read the turn order, not change it', async () => {
    const ClientMediator = (await import('./ClientMediator')).default;
    const fake = { panel: 'TurnOrder', id: 'TurnOrderTest', GetState: vi.fn(() => ({ round: 3 })), Next: vi.fn() };
    ClientMediator.register(fake);
    try {
      ActiveWebHelper.getAsync.mockResolvedValue([]);
      const api = await CardAPIFactory('card-turns');

      expect(await api.ClientMediator.sendCommandAsync('TurnOrder', 'GetState', {})).toEqual({ round: 3 });
      await expect(api.ClientMediator.sendCommandAsync('TurnOrder', 'Next', {})).rejects.toThrow('"TurnOrder.Next" is not available to cards');
      expect(fake.Next).not.toHaveBeenCalled();
    } finally {
      ClientMediator.unregister('TurnOrderTest');
    }
  });

  it("cards receive turn order notices (to show whose turn it is)", async () => {
    const { ALLOWED_WS_RECEIVE_PREFIXES } = await import('./CardAPI');
    expect(ALLOWED_WS_RECEIVE_PREFIXES).toContain('turnorder_');
  });
});

describe('CardAPI — GM check', () => {
  // Addons hide GM-only content (e.g. hidden homebrew) from players' lists.
  it('cards may ask whether the viewer is the GM, not change the game', async () => {
    const ClientMediator = (await import('./ClientMediator')).default;
    const fake = { panel: 'Game', id: 'GameGmTest', GetIsGM: vi.fn(() => true), DeleteGame: vi.fn() };
    ClientMediator.register(fake);
    try {
      ActiveWebHelper.getAsync.mockResolvedValue([]);
      const api = await CardAPIFactory('card-gm');

      expect(await api.ClientMediator.sendCommandAsync('Game', 'GetIsGM', {})).toBe(true);
      await expect(api.ClientMediator.sendCommandAsync('Game', 'DeleteGame', {})).rejects.toThrow('not available to cards');
      expect(fake.DeleteGame).not.toHaveBeenCalled();
    } finally {
      ClientMediator.unregister('GameGmTest');
    }
  });
});

// Properties.Global takes parentId from card code; it must stay one query value.
describe('CardAPI — Properties.Global query encoding', () => {
  beforeEach(() => {
    ActiveWebHelper.getAsync.mockReset();
    ActiveWebHelper.getAsync.mockResolvedValue([]);
  });

  it.each([
    ['Get', (api, id) => api.Properties.Global.Get(id, 'hp')],
    ['GetMany', (api, id) => api.Properties.Global.GetMany(id, ['hp'])],
    ['GetProperties', (api, id) => api.Properties.Global.GetProperties(id)],
  ])('%s encodes the parentId', async (_name, call) => {
    const api = await CardAPIFactory('card-x');
    ActiveWebHelper.getAsync.mockClear();

    await call(api, 'a&names=secret');

    const path = ActiveWebHelper.getAsync.mock.calls.at(-1)[0];
    const params = new URLSearchParams(path.split('?')[1]);
    expect(params.get('parentIds')).toBe('a&names=secret');
    expect(params.getAll('names').length).toBeLessThanOrEqual(1);
  });
});

describe('CardAPI — chat from a card', () => {
  // Regression: Chat.SendMessage went through the chat panel, where "/c <command>" runs
  // any client command — past the card allowlist.
  it('sends the text to the server as a chat message; "/c" never runs a local command', async () => {
    const ClientMediator = (await import('./ClientMediator')).default;
    const chat = { panel: 'chat', id: 'ChatTest', SendMessage: vi.fn() };
    ClientMediator.register(chat);
    try {
      ActiveWebHelper.getAsync.mockResolvedValue([]);
      ActiveTransportManager.Send.mockClear();
      const api = await CardAPIFactory('card-chat');

      await api.ClientMediator.sendCommandAsync('Chat', 'SendMessage', '/c Game DeleteGame');

      expect(chat.SendMessage).not.toHaveBeenCalled();
      expect(ActiveTransportManager.Send).toHaveBeenCalledWith(expect.objectContaining({ command: 'chat_push', data: '/c Game DeleteGame' }));
    } finally {
      ClientMediator.unregister('ChatTest');
    }
  });
});

describe('CardAPI — server commands', () => {
  // custom_panel_* (views) and custom_layer_* (map layers) are real server commands, run
  // with the permissions of whoever's browser the card is in.
  it('sends only chat and actions', async () => {
    ActiveWebHelper.getAsync.mockResolvedValue([]);
    ActiveTransportManager.Send.mockClear();
    const api = await CardAPIFactory('card-ws');

    api.SendCustomCommandToServer('custom_panel_delete', { id: 'x' });
    api.SendCustomCommandToServer('custom_layer_add', {});
    api.SendCustomCommandToServer('chat_push', 'hi');

    expect(ActiveTransportManager.Send.mock.calls.map(([c]) => c.command)).toEqual(['chat_push']);
  });
});

describe('CardAPI — mediator routing', () => {
  beforeEach(() => ActiveWebHelper.getAsync.mockResolvedValue([]));

  it('points Properties / Resources / Rolls callers at the CardAPI groups', async () => {
    const api = await CardAPIFactory('card-routing');

    await expect(api.ClientMediator.sendCommandAsync('Properties', 'Add', {})).rejects.toThrow('use CardAPI.Properties');
    await expect(api.ClientMediator.sendCommandAsync('Resources', 'Read', {})).rejects.toThrow('use CardAPI.Resources');
    await expect(api.ClientMediator.sendCommandAsync('Rolls', 'Start', {})).rejects.toThrow('use CardAPI.Rolls');
  });

  it("reaches other addons' panels (addon_*)", async () => {
    const ClientMediator = (await import('./ClientMediator')).default;
    const other = { panel: 'addon_card-x_tracker', id: 'addon_card-x_tracker', Ping: vi.fn(() => 'pong') };
    ClientMediator.register(other);
    try {
      const api = await CardAPIFactory('card-routing');

      expect(await api.ClientMediator.sendCommandAsync('addon_card-x_tracker', 'Ping', { a: 1 })).toBe('pong');
      expect(other.Ping).toHaveBeenCalledWith({ a: 1 });
    } finally {
      ClientMediator.unregister('addon_card-x_tracker');
    }
  });
});

// A card registers a panel by name and command list; the functions stay in its frame.
// Each call is handed to `invoke`, which CardPanel forwards to the frame.
describe('CardAPI — register', () => {
  beforeEach(() => ActiveWebHelper.getAsync.mockResolvedValue([]));

  it('registers a panel scoped to the card that forwards each command', async () => {
    const ClientMediator = (await import('./ClientMediator')).default;
    const api = await CardAPIFactory('card-reg');
    const invoke = vi.fn(async (name, command, data) => `${name}:${command}:${data.n}`);

    const scoped = api.ClientMediator.register('addon_tracker', ['Next', 'Reset'], invoke);

    expect(scoped).toBe('addon_card-reg_tracker');
    expect(await ClientMediator.sendCommandAsync(scoped, 'Next', { n: 2 })).toBe('addon_tracker:Next:2');
    expect(invoke).toHaveBeenCalledWith('addon_tracker', 'Next', { n: 2 });
    api.destroy();
    expect(await ClientMediator.sendCommandAsync(scoped, 'Next', { n: 3 })).toBeUndefined();
  });

  it('re-registering replaces the commands (the card reloaded), and unregister removes it', async () => {
    const ClientMediator = (await import('./ClientMediator')).default;
    const api = await CardAPIFactory('card-reg2');
    const invoke = vi.fn(async () => 'ok');

    const scoped = api.ClientMediator.register('addon_p', ['A'], invoke);
    api.ClientMediator.register('addon_p', ['B'], invoke);
    await expect(ClientMediator.sendCommandAsync(scoped, 'A', {})).rejects.toThrow();
    expect(await ClientMediator.sendCommandAsync(scoped, 'B', {})).toBe('ok');

    api.ClientMediator.unregister('addon_p');
    expect(await ClientMediator.sendCommandAsync(scoped, 'B', {})).toBeUndefined();
    api.destroy();
  });

  it('refuses names outside addon_ and reserved command names', async () => {
    const api = await CardAPIFactory('card-reg3');

    expect(() => api.ClientMediator.register('Game', ['X'], vi.fn())).toThrow('must start with "addon_"');
    const scoped = api.ClientMediator.register('addon_q', ['id', 'panel', 'Go', 42], vi.fn(async () => 1));
    const ClientMediator = (await import('./ClientMediator')).default;
    expect(ClientMediator._resolveClients(scoped)[0].panel).toBe(scoped);
    api.destroy();
  });
});


// Resources a card reads (a PDF, a big JSON file) are kept in the browser's resource cache
// like map images are: the server is asked "still this version?" instead of sending it again.
describe('CardAPI — Resources reads use the resource cache', () => {
  const b64 = (text) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));
  const bytesOf = (text) => new TextEncoder().encode(text).buffer;

  beforeEach(() => {
    ActiveWebHelper.GameId = 'game-1';
    ActiveWebHelper.getAsync.mockReset().mockResolvedValue([]);
    ResourceCache.get.mockReset().mockResolvedValue(null);
    ResourceCache.put.mockReset().mockResolvedValue(true);
  });

  it('stores what it fetched, under the same key the app caches resources by', async () => {
    const api = await CardAPIFactory('card-rc1');
    ActiveWebHelper.getAsync.mockResolvedValue({ data: b64('{"a":"żółw"}'), mimeType: 'application/json', version: 'v1' });

    const text = await api.Resources.Read('notes');

    expect(text).toBe('{"a":"żółw"}'); // UTF-8, not Latin-1
    expect(ActiveWebHelper.getAsync).toHaveBeenLastCalledWith('materials/resource?key=card-rc1%2Fnotes');
    expect(ResourceCache.put).toHaveBeenCalledWith('game-1:card-rc1/notes',
      expect.objectContaining({ mimeType: 'application/json', version: 'v1' }));
    api.destroy();
  });

  it('serves the cached copy when the server says it is still current', async () => {
    const api = await CardAPIFactory('card-rc2');
    ResourceCache.get.mockResolvedValue({ data: bytesOf('cached'), mimeType: 'text/plain', version: 'v7' });
    ActiveWebHelper.getAsync.mockResolvedValue({ notModified: true, version: 'v7' });

    const text = await api.Resources.Global.Read('shared/thing');

    expect(text).toBe('cached');
    expect(ActiveWebHelper.getAsync).toHaveBeenLastCalledWith('materials/resource?key=shared%2Fthing&ifVersion=v7');
    expect(ResourceCache.put).not.toHaveBeenCalled();
    api.destroy();
  });

  it('reads a resource by id (e.g. a file from the Materials panel) as a Blob', async () => {
    const api = await CardAPIFactory('card-rc3');
    ActiveWebHelper.getAsync.mockResolvedValue({ data: b64('%PDF-1.7'), mimeType: 'application/pdf', version: 'v2' });

    const blob = await api.Resources.ReadById('res-9');

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/pdf');
    // jsdom's Blob has no .text()
    const text = await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsText(blob); });
    expect(text).toBe('%PDF-1.7');
    expect(ActiveWebHelper.getAsync).toHaveBeenLastCalledWith('materials/resource?id=res-9');
    expect(ResourceCache.put).toHaveBeenCalledWith('game-1:res-9', expect.objectContaining({ version: 'v2' }));
    api.destroy();
  });

  it('returns null when there is no such resource', async () => {
    const api = await CardAPIFactory('card-rc4');
    ActiveWebHelper.getAsync.mockResolvedValue(null);

    expect(await api.Resources.ReadById('missing')).toBeNull();
    api.destroy();
  });

  it('lists the game resources the player can see, optionally of one type, without file data', async () => {
    const api = await CardAPIFactory('card-rc5');
    ActiveWebHelper.getAsync.mockResolvedValue([
      { id: 'r1', name: 'Handbook.pdf', mimeType: 'application/pdf', key: null, path: 'C:/x', playerName: 'GM' },
      { id: 'r2', name: 'map.png', mimeType: 'image/png', key: null },
    ]);

    expect(await api.Resources.List({ mimeType: 'application/pdf' }))
      .toEqual([{ id: 'r1', name: 'Handbook.pdf', mimeType: 'application/pdf', key: null }]);
    expect((await api.Resources.List()).map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(ActiveWebHelper.getAsync).toHaveBeenLastCalledWith('materials/getresources');
    api.destroy();
  });
});


// Part of a big resource (pdf.js asks for the bytes of the pages it shows): each part cached
// in the browser; once the server has said which version is current, cached parts of that
// version come without asking again.
describe('CardAPI — Resources.ReadRange', () => {
  const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
  const stored = new Map();

  beforeEach(() => {
    ActiveWebHelper.GameId = 'game-1';
    ActiveWebHelper.getAsync.mockReset().mockResolvedValue([]);
    stored.clear();
    ResourceCache.get.mockReset().mockImplementation(async (k) => stored.get(k) ?? null);
    ResourceCache.put.mockReset().mockImplementation(async (k, v) => { stored.set(k, v); return true; });
  });

  it('asks for the part, returns its bytes with the total, and caches it', async () => {
    const api = await CardAPIFactory('card-rr1');
    ActiveWebHelper.getAsync.mockResolvedValue({ data: b64([1, 2, 3]), start: 4096, total: 9000, mimeType: 'application/pdf', version: 'v1' });

    const part = await api.Resources.ReadRange({ id: 'res-1' }, 4096, 3);

    expect(ActiveWebHelper.getAsync).toHaveBeenLastCalledWith('materials/resourcerange?id=res-1&start=4096&length=3');
    expect([...part.bytes]).toEqual([1, 2, 3]);
    expect(part).toMatchObject({ start: 4096, total: 9000, version: 'v1' });
    expect(stored.get('game-1:res-1@4096+3')).toMatchObject({ version: 'v1' });
    api.destroy();
  });

  it('serves a cached part of the version the server named this session without asking', async () => {
    const api = await CardAPIFactory('card-rr2');
    stored.set('game-1:pdf_src_a.pdf@0+2', { data: new Uint8Array([7, 7]).buffer, mimeType: 'application/pdf', version: 'v2' });
    stored.set('game-1:pdf_src_a.pdf@2+2', { data: new Uint8Array([8, 8]).buffer, mimeType: 'application/pdf', version: 'v2' });
    ActiveWebHelper.getAsync.mockResolvedValue({ notModified: true, start: 0, total: 4, version: 'v2' });

    const first = await api.Resources.ReadRange({ key: 'pdf_src_a.pdf' }, 0, 2);
    expect(ActiveWebHelper.getAsync).toHaveBeenLastCalledWith('materials/resourcerange?key=pdf_src_a.pdf&start=0&length=2&ifVersion=v2');
    expect([...first.bytes]).toEqual([7, 7]);
    expect(first.total).toBe(4);

    ActiveWebHelper.getAsync.mockClear();
    const second = await api.Resources.ReadRange({ key: 'pdf_src_a.pdf' }, 2, 2);
    expect(ActiveWebHelper.getAsync).not.toHaveBeenCalled();
    expect([...second.bytes]).toEqual([8, 8]);
    expect(second.total).toBe(4);
    api.destroy();
  });

  it('asks again when the file changed, and gives nothing past the end or for a missing file', async () => {
    const api = await CardAPIFactory('card-rr3');
    stored.set('game-1:res-3@0+2', { data: new Uint8Array([1, 1]).buffer, mimeType: 'application/pdf', version: 'old' });
    ActiveWebHelper.getAsync.mockResolvedValueOnce({ data: b64([2, 2]), start: 0, total: 2, mimeType: 'application/pdf', version: 'new' });
    expect([...(await api.Resources.ReadRange({ id: 'res-3' }, 0, 2)).bytes]).toEqual([2, 2]);

    ActiveWebHelper.getAsync.mockResolvedValueOnce({ data: '', start: 50, total: 2, mimeType: 'application/pdf', version: 'new' });
    expect((await api.Resources.ReadRange({ id: 'res-3' }, 50, 2)).bytes.length).toBe(0);

    ActiveWebHelper.getAsync.mockResolvedValueOnce(null);
    expect(await api.Resources.ReadRange({ id: 'gone' }, 0, 2)).toBeNull();
    expect(await api.Resources.ReadRange({}, 0, 2)).toBeNull();
    api.destroy();
  });

  it("Global.Create can put a big file in the server's file storage", async () => {
    const api = await CardAPIFactory('card-rr4');
    ActiveWebHelper.postAsync.mockReset().mockResolvedValue({ status: 200, body: { id: 'new-id' } });

    await api.Resources.Global.Create('pdf_src_b.pdf', 'x', 'Book.pdf', 'application/pdf', { storage: 'file' });
    expect(ActiveWebHelper.postAsync).toHaveBeenLastCalledWith('materials/createresource', expect.objectContaining({ key: 'pdf_src_b.pdf', storageKind: 1 }));

    await api.Resources.Global.Create('plain', 'x');
    expect(ActiveWebHelper.postAsync.mock.calls.at(-1)[1].storageKind).toBeUndefined();
    api.destroy();
  });
});

// A card's big file goes up in parts too (WebRTCWebHelper.uploadInPieces), under its key.
describe('CardAPI — Resources.Create with a big file', () => {
  const big = () => new Blob([new Uint8Array(3 * 1024 * 1024)], { type: 'application/pdf' });

  beforeEach(() => {
    ActiveWebHelper.postAsync.mockReset().mockResolvedValue({ status: 200, body: { id: 'one-piece' } });
    ActiveWebHelper.uploadInPieces.mockReset();
  });

  it('sends it in parts under the card-scoped (or global) key, into file storage when asked', async () => {
    const api = await CardAPIFactory('card-up1');
    ActiveWebHelper.uploadInPieces.mockResolvedValue({ status: 200, body: { id: 'res-big' } });

    expect(await api.Resources.Create('book', big(), 'Book.pdf')).toBe('res-big');
    expect(ActiveWebHelper.uploadInPieces.mock.calls[0][1]).toEqual({ name: 'Book.pdf', mimeType: 'application/pdf', key: 'card-up1/book', storageKind: 0 });

    await api.Resources.Global.Create('pdf_src_x.pdf', big(), 'Book.pdf', 'application/pdf', { storage: 'file' });
    expect(ActiveWebHelper.uploadInPieces.mock.calls[1][1]).toMatchObject({ key: 'pdf_src_x.pdf', storageKind: 1 });
    expect(ActiveWebHelper.postAsync).not.toHaveBeenCalled();
    api.destroy();
  });

  it('a taken key is refused as before; an older server gets it in one piece', async () => {
    const api = await CardAPIFactory('card-up2');
    ActiveWebHelper.uploadInPieces.mockResolvedValueOnce({ status: 409, body: { error: 'taken' } });
    await expect(api.Resources.Global.Create('k', big())).rejects.toThrow('taken');

    ActiveWebHelper.uploadInPieces.mockResolvedValueOnce(null);
    expect(await api.Resources.Global.Create('k2', big())).toBe('one-piece');
    expect(ActiveWebHelper.postAsync).toHaveBeenCalledWith('materials/createresource', expect.objectContaining({ key: 'k2' }));
    api.destroy();
  });

  it('a small file is still one request', async () => {
    const api = await CardAPIFactory('card-up3');
    expect(await api.Resources.Global.Create('small', 'text')).toBe('one-piece');
    expect(ActiveWebHelper.uploadInPieces).not.toHaveBeenCalled();
    api.destroy();
  });
});
