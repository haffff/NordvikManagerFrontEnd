import { describe, it, expect } from 'vitest';
import {
  drawLayerOf, flagsForState, layerFlagUpdate, layerLabel, layerState, layerView,
} from './layerVisibility';

const layers = [
  { key: 'secrets', id: 'secrets', name: 'Secrets', layerId: 150, kind: 'custom', gmOnly: true, hidden: false },
  { key: 'reveal', id: 'reveal', name: 'Reveal', layerId: 140, kind: 'custom', gmOnly: false, hidden: true },
  { key: 'reserved-token', id: null, name: 'Token', layerId: 100, kind: 'reserved-token' },
  { key: 'decor', id: 'decor', name: 'Decor', layerId: 50, kind: 'custom', gmOnly: false, hidden: false },
];

describe('layer visibility', () => {
  it('hides hidden layers from everyone and GM-only layers from players', () => {
    const player = layerView(layers, false);
    expect([...player.hidden].sort()).toEqual([140, 150]);
    expect(player.dimmed.size).toBe(0);

    const gm = layerView(layers, true);
    expect([...gm.hidden]).toEqual([140]);
    expect([...gm.dimmed]).toEqual([150]);
  });

  it('counts token UI as the token layer', () => {
    expect(drawLayerOf({ isTokenUI: true, layer: 110 })).toBe(100);
    expect(drawLayerOf({ layer: 110 })).toBe(100);
    expect(drawLayerOf({ layer: 150 })).toBe(150);
  });

  it('has three states, each setting both flags', () => {
    expect(layers.map(layerState)).toEqual(['gmOnly', 'hidden', 'visible', 'visible']);
    expect(flagsForState('visible')).toEqual({ hidden: 'false', gmOnly: 'false' });
    expect(flagsForState('gmOnly')).toEqual({ hidden: 'false', gmOnly: 'true' });
    expect(flagsForState('hidden')).toEqual({ hidden: 'true', gmOnly: 'false' });
  });

  it('saves a state as a property list item update', () => {
    expect(layerFlagUpdate('prop-1', layers[3], 'hidden')).toEqual({
      command: 'property_list_item_update',
      data: { propertyId: 'prop-1', itemId: 'decor', fields: { hidden: 'true', gmOnly: 'false' } },
    });
  });

  it('marks GM-only and hidden layers in their names', () => {
    expect(layers.map(layerLabel)).toEqual(['Secrets (GM only)', 'Reveal (hidden)', 'Token', 'Decor']);
  });
});
