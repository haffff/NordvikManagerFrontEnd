import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// The real game initialization, talking to the demo transport instead of a GM backend.
vi.mock('../helpers/transport', async () => await import('./DemoTransport'));
vi.mock('../ClientMediator', () => ({ default: { register: vi.fn(), fireEvent: vi.fn(), sendCommand: vi.fn() } }));

import { ActiveTransportManager } from '../helpers/transport';
import { useGameInitialization } from '../components/game/hooks/useGameInitialization';
import { setDemoRole } from '../helpers/appMode';
import { pickFixture } from './demoFixtures';
import recordedGm from './fixtures/gm.json';
import recordedPlayer from './fixtures/player.json';

// What the demo serves: the recording if there is one, else the mock game.
const gmFixture = pickFixture(recordedGm, 'gm');
const playerFixture = pickFixture(recordedPlayer, 'player');

const gameState = () => ({
  setCurrentPlayerId: vi.fn(),
  setPlayers: vi.fn(),
  setLayout: vi.fn(),
  setIsGM: vi.fn(),
  currentPlayerRef: { current: undefined },
  gameRef: { current: undefined },
  keyboardEventsManagerRef: { current: { GetKeyboardConfigFromCentralServer: vi.fn(() => Promise.resolve()) } },
});

async function boot(role, fixture) {
  const notes = [];
  setDemoRole(role);
  ActiveTransportManager.Close();
  ActiveTransportManager.load(fixture, { onNote: (text, opts) => notes.push({ text, ...opts }) });
  ActiveTransportManager.Start('demo', vi.fn());

  const state = gameState();
  const { result } = renderHook(() => useGameInitialization({ state: {}, gameState: state, CreateLayoutElement: vi.fn() }));
  await act(async () => { await result.current.loadGame(); });
  const outcome = { result, state, notes };
  act(() => { result.current.resetInitialization(); });
  return outcome;
}

describe('the demo boots on its fixtures', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('GM view: the game loads and the visitor is the GM', async () => {
    const { result, state, notes } = await boot('gm', gmFixture);
    expect(result.current.initError).toBeNull();
    expect(state.setIsGM).toHaveBeenCalledWith(true);
    expect(state.gameRef.current?.id).toBe(gmFixture.requests['GET api/battlemap/getfullgame'].body.id);
    expect(state.setLayout).toHaveBeenCalledWith(expect.objectContaining({ value: expect.stringContaining('Battlemap') }));
    expect(notes).toEqual([]);
  });

  it('player view: the game loads and the visitor is a player', async () => {
    const { result, state, notes } = await boot('player', playerFixture);
    expect(result.current.initError).toBeNull();
    expect(state.setIsGM).toHaveBeenCalledWith(false);
    expect(state.setCurrentPlayerId).toHaveBeenCalledWith(playerFixture.requests['GET api/battlemap/getplayer'].body.id);
    expect(notes).toEqual([]);
  });
});
