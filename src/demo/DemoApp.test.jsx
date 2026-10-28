import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { transport, gameRenders } = vi.hoisted(() => ({
  transport: { load: vi.fn(), Close: vi.fn() },
  gameRenders: [],
}));

vi.mock('../helpers/transport', () => ({ ActiveTransportManager: transport, ActiveWebHelper: {} }));
vi.mock('../components/game/Game', () => ({
  Game: (props) => {
    gameRenders.push(props);
    return <div data-testid="game">{props.gameID}</div>;
  },
}));
vi.mock('../components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));

import { DemoApp } from './DemoApp';
import { getDemoRole } from '../helpers/appMode';
import { toaster } from '../components/ui/toaster';
import { Provider } from '../components/ui/provider';

const fixtures = {
  gm: { role: 'gm', requests: { 'GET api/battlemap/getfullgame': { status: 200, body: { id: 'game-1' } } }, after: {} },
  player: { role: 'player', requests: {}, after: {} },
};

const renderDemo = () => render(<Provider><DemoApp fixtures={fixtures} /></Provider>);

describe('DemoApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gameRenders.length = 0;
    window.history.replaceState(null, '', '/client/demo/');
  });

  it('opens the GM view by default, with that fixture loaded before the game starts', () => {
    renderDemo();
    expect(getDemoRole()).toBe('gm');
    expect(transport.load).toHaveBeenCalledWith(fixtures.gm, expect.objectContaining({ onNote: expect.any(Function) }));
    expect(screen.getByTestId('game').textContent).toBe('game-1');
    expect(gameRenders[0].centralSessionId).toBe('demo');
    expect(screen.getByText(/nothing is saved/i)).toBeTruthy();
  });

  it('?role=player opens the player view and shows the tour again', () => {
    window.localStorage.setItem('nm_tour_player_v1', '1');
    window.history.replaceState(null, '', '/client/demo/?role=player');
    renderDemo();
    expect(getDemoRole()).toBe('player');
    expect(transport.load).toHaveBeenCalledWith(fixtures.player, expect.anything());
    expect(window.localStorage.getItem('nm_tour_player_v1')).toBeNull();
  });

  it('switching view reloads the data and starts a fresh game', () => {
    renderDemo();
    const before = transport.load.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Player' }));
    expect(getDemoRole()).toBe('player');
    expect(transport.Close).toHaveBeenCalled();
    expect(transport.load.mock.calls.length).toBeGreaterThan(before);
    expect(transport.load).toHaveBeenLastCalledWith(fixtures.player, expect.anything());
    expect(window.location.search).toBe('?role=player');
  });

  it('Reset starts over with the same view', () => {
    renderDemo();
    const before = transport.load.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(transport.load.mock.calls.length).toBe(before + 1);
    expect(transport.load).toHaveBeenLastCalledWith(fixtures.gm, expect.anything());
  });

  it('shows notes about things the demo cannot do, but keeps quiet ones in the console', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    renderDemo();
    const { onNote } = transport.load.mock.calls[0][1];
    act(() => { onNote('Not available in the demo: addon/install', { quiet: false }); });
    expect(toaster.create).toHaveBeenCalledWith(expect.objectContaining({ description: 'Not available in the demo: addon/install' }));
    act(() => { onNote('Not available in the demo: session/whoami', { quiet: true }); });
    expect(toaster.create).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalled();
    info.mockRestore();
  });
});
