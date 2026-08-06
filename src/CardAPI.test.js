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
  },
  ActiveWebHelper: {
    getAsync: vi.fn(),
    postAsync: vi.fn(),
  },
}));

import { ActiveTransportManager, ActiveWebHelper } from './helpers/transport';
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
