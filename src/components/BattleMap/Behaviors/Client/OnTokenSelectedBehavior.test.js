import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../../ClientMediator', () => ({ default: { sendCommand: vi.fn() } }));

import ClientMediator from '../../../../ClientMediator';
import { OnTokenSelectedClientBehavior } from './OnTokenSelectedBehavior';

// Selecting a token unfolds its collapsed status icons; deselecting folds them again.

const canvas = { renderAll: vi.fn(), requestRenderAll: vi.fn() };
const token = (id) => ({ id, tokenData: {}, additionalObjects: [] });

describe('OnTokenSelectedClientBehavior', () => {
  beforeEach(() => vi.clearAllMocks());

  it('expands the selected token\'s icons', () => {
    const t = token('a');

    new OnTokenSelectedClientBehavior().Handle({ selected: [t] }, canvas, {}, 'map-1');

    expect(t._iconsExpanded).toBe(true);
    expect(ClientMediator.sendCommand).toHaveBeenCalledWith(
      'BattleMap_Token', 'UpdateTokenUIPositions', { object: t, contextId: 'map-1' });
  });

  it('collapses the deselected token\'s icons', () => {
    const t = token('a');
    t._iconsExpanded = true;

    new OnTokenSelectedClientBehavior().Handle({ deselected: [t], selected: [] }, canvas, {}, 'map-1');

    expect(t._iconsExpanded).toBe(false);
    expect(ClientMediator.sendCommand).toHaveBeenCalledWith(
      'BattleMap_Token', 'UpdateTokenUIPositions', { object: t, contextId: 'map-1' });
  });

  it('keeps icons collapsed for tokens selected together', () => {
    const a = token('a');
    const b = token('b');

    new OnTokenSelectedClientBehavior().Handle({ selected: [a, b] }, canvas, {}, 'map-1');

    expect(a._iconsExpanded).toBeFalsy();
    expect(b._iconsExpanded).toBeFalsy();
  });

  // Deselecting fades a token's on-selection parts out and hides them at the end; a
  // token selected again before the fade ends must keep them.
  it('keeps the parts shown when the token is selected again mid-fade', () => {
    const fades = [];
    const part = {
      tokenData: { showOnTokenControl: true },
      visible: true,
      set(props) { Object.assign(this, props); },
      animate: vi.fn((prop, to, options) => fades.push(options)),
    };
    const t = { ...token('a'), additionalObjects: [part] };
    const behavior = new OnTokenSelectedClientBehavior();

    behavior.Handle({ deselected: [t], selected: [] }, canvas, {}, 'map-1');
    behavior.Handle({ selected: [t] }, canvas, {}, 'map-1');
    fades[0].onComplete(); // the fade-out finishes late

    expect(part.visible).toBe(true);
    expect(t._controlsShown).toBe(true);
  });
});
