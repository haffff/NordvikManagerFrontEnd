import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

let layers = [];
let canEdit = false;
vi.mock('../../uiComponents/hooks/useCustomLayers', () => ({ useCustomLayers: () => ({ layers }) }));
vi.mock('../../../ClientMediator', () => ({
  default: { sendCommand: vi.fn((panel, cmd) => (cmd === 'GetCanEditGame' ? canEdit : cmd === 'GetGameId' ? 'game-1' : undefined)) },
}));

import { useLayerView } from './useLayerView';

const fakeCanvas = () => ({
  _checkTarget: () => true,
  _renderObjects: () => {},
  _collectObjects: () => [],
  getActiveObjects: () => [],
  discardActiveObject: vi.fn(),
  requestRenderAll: vi.fn(),
});

describe('useLayerView', () => {
  beforeEach(() => {
    layers = [{ key: 's', id: 's', name: 'Secrets', layerId: 150, kind: 'custom', gmOnly: true }];
  });

  it("hides GM-only layers from a player who can't edit the game", () => {
    canEdit = false;
    const canvas = fakeCanvas();
    renderHook(() => useLayerView(canvas));

    expect([...canvas.layerView.hidden]).toEqual([150]);
  });

  it("fades them for whoever can edit the game (not only its owner), and follows changes to the layers", () => {
    canEdit = true;
    const canvas = fakeCanvas();
    const { rerender } = renderHook(() => useLayerView(canvas));
    expect([...canvas.layerView.dimmed]).toEqual([150]);

    layers = [{ ...layers[0], gmOnly: false, hidden: true }];
    rerender();

    expect([...canvas.layerView.hidden]).toEqual([150]);
    expect(canvas.layerView.dimmed.size).toBe(0);
  });
});
