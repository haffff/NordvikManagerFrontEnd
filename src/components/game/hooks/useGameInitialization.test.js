import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: { getAsync: vi.fn() },
  // Subscribe/Unsubscribe are required by CardAPI.js's PropertiesManager
  // constructor, instantiated at module load time as PropertiesManagerInstance.
  ActiveTransportManager: { Send: vi.fn(), Subscribe: vi.fn(), Unsubscribe: vi.fn() },
}));

vi.mock('../../../ClientMediator', () => ({
  default: { register: vi.fn(), fireEvent: vi.fn(), sendCommand: vi.fn() },
}));

import { ActiveWebHelper as WebHelper } from '../../../helpers/transport';
import { useGameInitialization } from './useGameInitialization';

function makeGameState() {
  return {
    setCurrentPlayerId: vi.fn(),
    setPlayers: vi.fn(),
    setLayout: vi.fn(),
    setIsGM: vi.fn(),
    currentPlayerRef: { current: undefined },
    gameRef: { current: undefined },
    keyboardEventsManagerRef: {
      current: { GetKeyboardConfigFromCentralServer: vi.fn(() => Promise.resolve()) },
    },
  };
}

// A promise this test can resolve on demand, to control exactly when an
// in-flight loadGame() "arrives" relative to an unmount/reset.
function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

// Regression coverage for the generation-token fix: gameInitializationInProgress/
// gameInitialized/gameInitGeneration are module-level (shared across every mount),
// while gameRef/currentPlayerRef etc. are per-mount. A loadGame() abandoned by a
// fast exit (Game.js's unmount effect calls resetInitialization()) used to still
// run to completion and could either write into a dead mount's refs, or clear a
// newer mount's legitimately in-progress flag out from under it via a stale
// `finally`.
describe('useGameInitialization generation token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not write into refs when resolved after resetInitialization() has already run (simulated unmount)', async () => {
    const gameState = makeGameState();
    const { result } = renderHook(() =>
      useGameInitialization({ state: {}, gameState, CreateLayoutElement: vi.fn() })
    );

    const playerDeferred = deferred();
    WebHelper.getAsync.mockReturnValueOnce(playerDeferred.promise); // battlemap/getplayer

    let loadPromise;
    act(() => {
      loadPromise = result.current.loadGame();
    });

    // Simulate the component unmounting before the fetch resolves — this is
    // exactly what Game.js's unmount effect does.
    act(() => {
      result.current.resetInitialization();
    });

    // The abandoned fetch now resolves late.
    await act(async () => {
      playerDeferred.resolve({ id: 'player-1' });
      await loadPromise;
    });

    // It must not have written into this (now-dead) mount's refs/state.
    expect(gameState.currentPlayerRef.current).toBeUndefined();
    expect(gameState.setCurrentPlayerId).not.toHaveBeenCalled();
  });

  it("a stale abandoned loadGame()'s finally does not clear a newer generation's in-progress guard", async () => {
    const gameState = makeGameState();
    const { result } = renderHook(() =>
      useGameInitialization({ state: {}, gameState, CreateLayoutElement: vi.fn() })
    );

    const staleCallDeferred = deferred(); // generation G's own getplayer
    const newCallDeferred = deferred(); // generation G+1's own getplayer
    const playerCalls = [staleCallDeferred.promise, newCallDeferred.promise];
    WebHelper.getAsync.mockImplementation((path) => {
      if (path === 'battlemap/getplayer') return playerCalls.shift();
      return new Promise(() => {}); // getfullgame etc. — never needed for this test
    });

    // Call #1 — generation G, gets stuck awaiting getplayer.
    let stalePromise;
    act(() => {
      stalePromise = result.current.loadGame();
    });

    // Simulated fast exit/rejoin: bumps to generation G+1.
    act(() => {
      result.current.resetInitialization();
    });

    // Call #2 — generation G+1, legitimately in progress (also stuck awaiting
    // its own getplayer).
    act(() => {
      result.current.loadGame();
    });

    // Now the STALE call #1 resolves. Its generation (G) no longer matches the
    // current one (G+1), so its `finally` must NOT touch gameInitializationInProgress.
    await act(async () => {
      staleCallDeferred.resolve({ id: 'stale-player' });
      await stalePromise;
    });

    const getplayerCallsBefore = WebHelper.getAsync.mock.calls.filter(
      (c) => c[0] === 'battlemap/getplayer'
    ).length;

    // Call #2 is still legitimately in progress — a third loadGame() call
    // (same generation) must be a no-op. If the stale call's finally had wrongly
    // cleared the in-progress flag, this would proceed and fetch again.
    act(() => {
      result.current.loadGame();
    });

    const getplayerCallsAfter = WebHelper.getAsync.mock.calls.filter(
      (c) => c[0] === 'battlemap/getplayer'
    ).length;

    expect(getplayerCallsAfter).toBe(getplayerCallsBefore);
  });
});
