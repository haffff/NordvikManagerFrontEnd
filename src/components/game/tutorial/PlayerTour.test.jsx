import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ClientMediator from '../../../ClientMediator';
import PlayerTour from './PlayerTour';
import { TOUR_STORAGE_KEY } from './tourSteps';

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
};

describe('PlayerTour', () => {
  let drive;
  let driverFactory;

  beforeEach(() => {
    vi.useFakeTimers();
    // One tour target on screen (jsdom does no layout, so give it a box).
    document.body.innerHTML = '<div class="nm_basePanel" data-panel="ChatPanel"></div>';
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{ width: 10, height: 10 }]);
    drive = vi.fn();
    driverFactory = vi.fn(() => ({ drive }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const setup = (props) =>
    render(<PlayerTour driverFactory={driverFactory} delayMs={500} {...props} />);

  it('starts once, shortly after the game has loaded, for a player who has not seen it', () => {
    const { rerender } = setup({ ready: false, isGM: false, storage: memoryStorage() });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(drive).not.toHaveBeenCalled();

    const storage = memoryStorage();
    rerender(<PlayerTour driverFactory={driverFactory} delayMs={500} ready={true} isGM={false} storage={storage} />);
    act(() => { vi.advanceTimersByTime(499); });
    expect(drive).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(drive).toHaveBeenCalledTimes(1);

    rerender(<PlayerTour driverFactory={driverFactory} delayMs={500} ready={true} isGM={false} storage={storage} />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(drive).toHaveBeenCalledTimes(1);
  });

  it('does not start for the GM', () => {
    setup({ ready: true, isGM: true, storage: memoryStorage() });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(drive).not.toHaveBeenCalled();
  });

  it('does not start again once seen', () => {
    setup({ ready: true, isGM: false, storage: memoryStorage({ [TOUR_STORAGE_KEY]: '1' }) });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(drive).not.toHaveBeenCalled();
  });

  it('"Show tutorial" (Tutorial.Start) runs it any time, for anyone', () => {
    const { unmount } = setup({ ready: true, isGM: true, storage: memoryStorage({ [TOUR_STORAGE_KEY]: '1' }) });
    act(() => { ClientMediator.sendCommand('Tutorial', 'Start'); });
    expect(drive).toHaveBeenCalledTimes(1);

    unmount();
    expect(ClientMediator.sendCommand('Tutorial', 'Start')).toBeUndefined();
  });
});
