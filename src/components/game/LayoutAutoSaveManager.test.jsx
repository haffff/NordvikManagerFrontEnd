import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';

let gameSettings = { id: 'game-1', saveLayoutOnExit: false };
vi.mock('../../ClientMediator', () => ({
  default: {
    sendCommand: vi.fn((panel, cmd) => {
      if (cmd === 'GetGame') return gameSettings;
      if (cmd === 'GetCurrentPlayer') return { id: 'player-1' };
      return undefined;
    }),
    on: vi.fn(() => 'handle'),
    off: vi.fn(),
  },
}));
vi.mock('../../helpers/LayoutCloneHelper', () => ({
  default: { GetCloneForSavingSafe: vi.fn(() => ({ __clone: true })) },
}));
vi.mock('../../helpers/LayoutPersistence', () => ({
  default: { save: vi.fn(), load: vi.fn(), clear: vi.fn() },
}));

import LayoutPersistence from '../../helpers/LayoutPersistence';
import LayoutHelper from '../../helpers/LayoutCloneHelper';
import LayoutAutoSaveManager from './LayoutAutoSaveManager';

const makeState = (token) => ({ updateToken: token, ref: { current: { rootPanel: { contentList: [] } } } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  gameSettings = { id: 'game-1', saveLayoutOnExit: false };
});

describe('LayoutAutoSaveManager', () => {
  it('renders nothing and does not save when saveLayoutOnExit is off', () => {
    vi.useFakeTimers();
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { container, rerender } = render(<LayoutAutoSaveManager state={makeState(0)} battlemapsRef={{}} />);
    expect(container.firstChild).toBeNull();

    act(() => { rerender(<LayoutAutoSaveManager state={makeState(1)} battlemapsRef={{}} />); });
    act(() => { vi.advanceTimersByTime(10000); });

    expect(LayoutPersistence.save).not.toHaveBeenCalled();
    expect(addSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('debounced-saves on a dockable change when enabled', () => {
    gameSettings = { id: 'game-1', saveLayoutOnExit: true };
    vi.useFakeTimers();
    const { rerender } = render(<LayoutAutoSaveManager state={makeState(0)} battlemapsRef={{}} />);

    act(() => { rerender(<LayoutAutoSaveManager state={makeState(1)} battlemapsRef={{}} />); });
    expect(LayoutPersistence.save).not.toHaveBeenCalled(); // still within debounce window
    act(() => { vi.advanceTimersByTime(4000); });

    expect(LayoutHelper.GetCloneForSavingSafe).toHaveBeenCalled();
    expect(LayoutPersistence.save).toHaveBeenCalledWith('game-1', 'player-1', { __clone: true });
  });

  it('flushes synchronously on beforeunload when enabled', () => {
    gameSettings = { id: 'game-1', saveLayoutOnExit: true };
    render(<LayoutAutoSaveManager state={makeState(0)} battlemapsRef={{}} />);

    act(() => { window.dispatchEvent(new Event('beforeunload')); });

    expect(LayoutPersistence.save).toHaveBeenCalledWith('game-1', 'player-1', { __clone: true });
  });
});
