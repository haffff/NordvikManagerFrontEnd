import { vi, describe, it, expect, beforeEach } from 'vitest';

const sendCommand = vi.fn();
vi.mock('../../../../../ClientMediator', () => ({
  default: { sendCommand: (...args) => sendCommand(...args) },
}));

import { OnSelectionStopFreeDrawClientBehavior } from './OnSelectionStopFreeDraw';

// Drawing and selecting at once: fabric's drawing mode only blocks selecting by
// mouse, while elements still get selected from elsewhere (turn order, tree,
// objects list → FocusElement / setActiveObject). Selecting one ends drawing.
describe('selecting an element while drawing', () => {
  beforeEach(() => sendCommand.mockClear());

  it('turns draw mode off, keeping the selection', () => {
    const canvas = { freeDrawMode: true };

    new OnSelectionStopFreeDrawClientBehavior().Handle({ selected: [{}] }, canvas, {}, 'bm-1');

    expect(sendCommand).toHaveBeenCalledWith('BattleMap', 'SetFreeDrawMode', { contextId: 'bm-1', enabled: false });
  });

  it('does nothing when not drawing', () => {
    new OnSelectionStopFreeDrawClientBehavior().Handle({ selected: [{}] }, {}, {}, 'bm-1');

    expect(sendCommand).not.toHaveBeenCalled();
  });
});
