import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
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

import * as Transport from '../../../helpers/transport';
import { ActiveWebHelper as WebHelper } from '../../../helpers/transport';
import { setActiveUiMode } from '../../../helpers/uiMode';
import { getTabsSnapshot, resetTabs } from '../mobile/mobileTabs';
import { useGameInitialization } from './useGameInitialization';

function makeGameState() {
  return {
    setCurrentPlayerId: vi.fn(),
    setPlayers: vi.fn(),
    setLayout: vi.fn(),
    setIsOwner: vi.fn(),
    setIsLocalAdmin: vi.fn(),
    setGamePermission: vi.fn(),
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

  it('takes ownership, the game permission and local admin from the full game', async () => {
    const gameState = makeGameState();
    const { result } = renderHook(() =>
      useGameInitialization({ state: {}, gameState, CreateLayoutElement: vi.fn() })
    );
    WebHelper.getAsync.mockImplementation(async (path) => {
      if (path === 'battlemap/getplayer') return { id: 'p2' };
      if (path === 'battlemap/getfullgame') return { id: 'g1', master: { id: 'p1' }, players: [], battleMaps: [], permission: 9, isLocalAdmin: true };
      return null;
    });

    await act(async () => { await result.current.loadGame(); });

    expect(gameState.setIsOwner).toHaveBeenCalledWith(false);
    expect(gameState.setGamePermission).toHaveBeenCalledWith(9);
    expect(gameState.setIsLocalAdmin).toHaveBeenCalledWith(true);
    expect(WebHelper.getAsync).not.toHaveBeenCalledWith(expect.stringContaining('security/permissions'));
    act(() => { result.current.resetInitialization(); }); // initialization state is module-level
  });

  it('ready turns true once the game has loaded, and false again on reset', async () => {
    const gameState = makeGameState();
    const { result } = renderHook(() =>
      useGameInitialization({ state: {}, gameState, CreateLayoutElement: vi.fn() })
    );
    WebHelper.getAsync.mockImplementation(async (path) => {
      if (path === 'battlemap/getplayer') return { id: 'p1' };
      if (path === 'battlemap/getfullgame') return { id: 'g1', master: { id: 'p1' }, players: [], battleMaps: [] };
      return null;
    });

    expect(result.current.ready).toBe(false);
    await act(async () => { await result.current.loadGame(); });
    expect(result.current.ready).toBe(true);

    act(() => { result.current.resetInitialization(); });
    expect(result.current.ready).toBe(false);
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

describe('useGameInitialization in the mobile UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTabs();
    setActiveUiMode('mobile');
  });
  afterEach(() => setActiveUiMode('desktop'));

  const layout = { _contents: [{ contentId: 'c1', type: 'ChatPanel', props: {} }, { contentId: 'c2', type: 'CardPanel', props: { id: 'k' } }] };
  const create = (content) => ({ type: Object.defineProperty(() => null, 'name', { value: content.type }), props: content.props ?? {} });

  async function load(game) {
    const state = { ref: { current: {} }, commit: vi.fn() };
    const gameState = makeGameState();
    const { result } = renderHook(() =>
      useGameInitialization({ state, gameState, CreateLayoutElement: vi.fn(create) })
    );
    WebHelper.getAsync.mockImplementation(async (path) => {
      if (path === 'battlemap/getplayer') return { id: 'p1' };
      if (path === 'battlemap/getfullgame') return { id: 'g1', master: { id: 'p1' }, players: [], battleMaps: [], ...game };
      return null;
    });
    // The initialization guard is module-level: an earlier test may have left a load in flight.
    act(() => { result.current.resetInitialization(); });
    await act(async () => { await result.current.loadGame(); });
    act(() => { result.current.resetInitialization(); });
    return state;
  }

  it("opens the layout's panels as tabs and leaves the dock alone", async () => {
    const state = await load({ defaultLayout: { id: 'l1', value: JSON.stringify(layout) } });
    expect(getTabsSnapshot().tabs.map((t) => t.panelKey)).toEqual(['ChatPanel', 'CardPanel']);
    expect(state.ref.current.rootPanel).toBeUndefined();
    expect(Transport.ActiveTransportManager.Send).toHaveBeenCalledWith({ command: 'client_layout_ready' });
  });

  it('opens the chat when the layout has no panels', async () => {
    await load({ defaultLayout: null });
    expect(getTabsSnapshot().tabs.map((t) => t.panelKey)).toEqual(['ChatPanel']);
  });

  // The phone's tabs mount from their own store as the layout is applied, so a chat can read
  // the player list before React has set it ("[Unknown]" for every sender until someone joined):
  // the loaded players are announced once the layout is up.
  it('tells the panels it opened who the players are, once they are loaded', async () => {
    const ClientMediator = (await import('../../../ClientMediator')).default;
    await load({ defaultLayout: { id: 'l1', value: JSON.stringify(layout) }, players: [{ id: 'p1', name: 'Game Master' }] });

    expect(ClientMediator.fireEvent).toHaveBeenCalledWith('PlayersChanged', { all: [{ id: 'p1', name: 'Game Master' }], connected: [] });
  });
});

// After a dropped connection the game's players, permissions and maps may have changed
// meanwhile: they are fetched again, without touching the layout or re-running Load hooks.
describe('useGameInitialization refreshGame', () => {
  beforeEach(() => vi.clearAllMocks());

  const fullGame = (overrides = {}) => ({
    id: 'g1', master: { id: 'p1' }, players: [{ id: 'p1' }, { id: 'p3' }], battleMaps: [{ id: 'm1' }],
    permission: 3, isLocalAdmin: false, defaultLayout: { value: '{}' }, ...overrides,
  });

  it('reloads players, ownership, permission and maps, and asks who is connected', async () => {
    const ClientMediator = (await import('../../../ClientMediator')).default;
    const gameState = makeGameState();
    gameState.currentPlayerRef.current = { id: 'p1' };
    const { result } = renderHook(() =>
      useGameInitialization({ state: {}, gameState, CreateLayoutElement: vi.fn() })
    );
    WebHelper.getAsync.mockImplementation(async (path) => (path === 'battlemap/getfullgame' ? fullGame() : null));

    await act(async () => { await result.current.refreshGame(); });

    expect(gameState.gameRef.current.id).toBe('g1');
    expect(gameState.setPlayers).toHaveBeenCalledWith([{ id: 'p1' }, { id: 'p3' }]);
    expect(gameState.setIsOwner).toHaveBeenCalledWith(true);
    expect(gameState.setGamePermission).toHaveBeenCalledWith(3);
    expect(ClientMediator.fireEvent).toHaveBeenCalledWith('BattleMapsChanged', [{ id: 'm1' }]);
    expect(ClientMediator.fireEvent).toHaveBeenCalledWith('PlayersChanged', { all: [{ id: 'p1' }, { id: 'p3' }], connected: [] });
    expect(Transport.ActiveTransportManager.Send).toHaveBeenCalledWith({ command: 'player_list' });
  });

  it('leaves the layout alone and does not announce the client again', async () => {
    const gameState = makeGameState();
    gameState.currentPlayerRef.current = { id: 'p1' };
    const { result } = renderHook(() =>
      useGameInitialization({ state: {}, gameState, CreateLayoutElement: vi.fn() })
    );
    WebHelper.getAsync.mockImplementation(async (path) => (path === 'battlemap/getfullgame' ? fullGame() : null));

    await act(async () => { await result.current.refreshGame(); });

    expect(gameState.setLayout).not.toHaveBeenCalled();
    const sent = Transport.ActiveTransportManager.Send.mock.calls.map(([m]) => m.command);
    expect(sent).not.toContain('client_layout_ready'); // would run addons' Load hooks again
    expect(sent).not.toContain('client_loaded');
  });

  it('keeps what it had when the game cannot be fetched', async () => {
    const gameState = makeGameState();
    gameState.gameRef.current = { id: 'old' };
    const { result } = renderHook(() =>
      useGameInitialization({ state: {}, gameState, CreateLayoutElement: vi.fn() })
    );
    WebHelper.getAsync.mockResolvedValue(null);

    await act(async () => { await result.current.refreshGame(); });

    expect(gameState.gameRef.current.id).toBe('old');
    expect(gameState.setPlayers).not.toHaveBeenCalled();
  });
});
