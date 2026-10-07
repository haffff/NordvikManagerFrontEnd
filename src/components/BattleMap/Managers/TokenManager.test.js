import { vi, describe, it, expect, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: {
    getMaterialAsync: vi.fn(),
    getResourceString: vi.fn((id, key) => `resource:${id ?? key}`),
  },
  ActiveTransportManager: { Send: vi.fn() },
}));
vi.mock('../../../ClientMediator', () => ({
  default: { sendCommand: vi.fn(), sendCommandAsync: vi.fn() },
}));
// Only what CreateToken uses: load the image, then copy the token's fields onto it.
vi.mock('fabric', () => ({
  fabric: {
    Image: {
      fromURL: (url, cb) => cb({
        width: 100,
        height: 100,
        set(props) { Object.assign(this, props); },
        scaleToWidth: vi.fn(),
      }),
    },
    Circle: class { constructor(o) { Object.assign(this, o); } },
  },
}));
vi.mock('../DTOConverter', () => ({
  default: { ConvertToDTO: (o) => ({ name: o.name, cardId: o.cardId, isToken: o.isToken, tokenData: o.tokenData, resourceId: o.resourceId, mapId: o.mapId }) },
}));

import TokenManager from './TokenManager';
import { ActiveWebHelper as WebHelper, ActiveTransportManager } from '../../../helpers/transport';
import ClientMediator from '../../../ClientMediator';

const definition = {
  name: 'token',
  prefix: 'Token',
  size: 1,
  object: { type: 'image' },
  editableProps: [
    { name: 'tokenImage', dtoProperty: 'tokenImage', label: 'Image', source: 'element', type: 'image' },
    { name: 'bar1_value', dtoProperty: 'bar1_value', label: 'Bar 1', source: 'element' },
  ],
  additions: [],
};

const manager = () => {
  const tm = new TokenManager();
  tm._getCanvas = () => ({ getObjects: () => [], requestRenderAll: vi.fn() });
  return tm;
};

const sentElement = async () => {
  await waitFor(() => expect(ActiveTransportManager.Send).toHaveBeenCalled());
  return ActiveTransportManager.Send.mock.calls[0][0];
};

describe('TokenManager.CreateToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ClientMediator.sendCommand.mockImplementation((panel, command) =>
      panel === 'BattleMap' && command === 'GetSelectedMap' ? { id: 'map-1', gridSize: 50 } : undefined);
  });

  it('places a token from a definition, with no card', async () => {
    WebHelper.getMaterialAsync.mockResolvedValue(JSON.stringify(definition));

    manager().CreateToken({ token: 'basics_token_generic.json', position: { x: 10, y: 20 } });

    const { command, data } = await sentElement();
    expect(command).toBe('element_add');
    // definition fetched by its resource key; no card properties read
    expect(WebHelper.getMaterialAsync).toHaveBeenCalledWith(null, 'application/json', 'basics_token_generic.json');
    expect(ClientMediator.sendCommandAsync).not.toHaveBeenCalled();

    expect(data.cardId).toBeUndefined();
    expect(data.tokenData.cardId).toBeUndefined();
    expect(data.name).toBe('Token');
    expect(data.tokenData.editableProps).toEqual(definition.editableProps);
    // its image is stored on the token itself
    expect(data.tokenData.propDeps).toContainEqual(expect.objectContaining({ dtoProperty: 'tokenImage', objectProperty: 'src', source: 'element' }));
    expect(data.properties).toContainEqual({ name: 'isToken', value: 'true' });
  });

  it('still places a card token with the image from the card', async () => {
    ClientMediator.sendCommandAsync.mockResolvedValue([
      { name: 'token', value: 'dnd5e_token_character.json' },
      { name: 'character_name', value: 'Vex' },
    ]);
    WebHelper.getMaterialAsync.mockResolvedValue(JSON.stringify({ ...definition, prefix: 'pc' }));

    manager().CreateToken({ cardId: 'card-1', position: { x: 0, y: 0 } });

    const { data } = await sentElement();
    expect(data.cardId).toBe('card-1');
    expect(data.tokenData.cardId).toBe('card-1');
    expect(data.name).toBe('pc Vex');
    expect(data.tokenData.propDeps).toContainEqual(expect.objectContaining({ dtoProperty: 'tokenImage', source: 'card' }));
  });

  it('as a command, needs a card or a token definition', () => {
    expect(manager().CreateToken({ isCommand: true })).toMatch(/--cardId or --token is required/);
  });
});
