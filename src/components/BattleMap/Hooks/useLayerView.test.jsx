import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

let layers = [];
let isGM = false;
vi.mock('../../uiComponents/hooks/useCustomLayers', () => ({ useCustomLayers: () => ({ layers }) }));
vi.mock('../../../ClientMediator', () => ({
  default: { sendCommand: vi.fn((panel, cmd) => (cmd === 'GetIsGM' ? isGM : cmd === 'GetGameId' ? 'game-1' : undefined)) },
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

  it("hides GM-only layers on a player's canvas", () => {
    isGM = false;
    const canvas = fakeCanvas();
    renderHook(() => useLayerView(canvas));

    expect([...canvas.layerView.hidden]).toEqual([150]);
  });

  it("fades them on the GM's, and follows changes to the layers", () => {
    isGM = true;
    const canvas = fakeCanvas();
    const { rerender } = renderHook(() => useLayerView(canvas));
    expect([...canvas.layerView.dimmed]).toEqual([150]);

    layers = [{ ...layers[0], gmOnly: false, hidden: true }];
    rerender();

    expect([...canvas.layerView.hidden]).toEqual([150]);
    expect(canvas.layerView.dimmed.size).toBe(0);
  });
});
