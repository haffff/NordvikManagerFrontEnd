import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../setupTests';

vi.mock('../../helpers/transport', () => ({
  ActiveWebHelper: { GameId: undefined },
  ActiveTransportManager: {
    WebSocketStarted: true,
    Start: vi.fn(),
    forceReconnect: vi.fn(),
  },
}));

vi.mock('@hlorenzi/react-dockable', () => ({
  useDockable: () => ({}),
  Container: () => null,
}));

vi.mock('./ToolBar/MainToolbar', () => ({ default: () => null }));
vi.mock('../uiComponents/base/Subscribable', () => ({ default: () => null }));
vi.mock('./PlaybackManager', () => ({ default: () => null }));
vi.mock('../QuickCommandDialog', () => ({ default: () => null }));
vi.mock('../uiComponents/WebSocketStatus', () => ({ default: () => null }));
vi.mock('../uiComponents/LoadingScreen', () => ({ LoadingScreen: () => <div>Loading</div> }));
vi.mock('../uiComponents/base/DragOptimizationContext', () => ({
  DragOptimizationProvider: ({ children }) => children,
}));
vi.mock('../../contexts/PermissionsContext', () => ({
  PermissionsProvider: ({ children }) => children,
}));
vi.mock('../../helpers/DockableHelper', () => ({
  default: { setGlobalState: vi.fn(), getPopOutHandler: vi.fn(() => vi.fn()) },
}));
vi.mock('../../helpers/PanelsList', () => ({ default: {} }));

const { loadGameMock, resetInitializationMock } = vi.hoisted(() => ({
  loadGameMock: vi.fn(() => Promise.resolve()),
  resetInitializationMock: vi.fn(),
}));
vi.mock('./hooks/useGameInitialization', () => ({
  useGameInitialization: () => ({
    loadGame: loadGameMock,
    initError: 'Something broke',
    clearInitError: vi.fn(),
    resetInitialization: resetInitializationMock,
    isInitialized: () => true, // skip the mount effect's own loadGame() call
  }),
}));

vi.mock('./hooks/useGameState', () => ({
  useGameState: () => ({
    battleMapContexts: [],
    portaledPanels: null,
    gameContainerRef: { current: null },
    quickCommandDialogOpenRef: { current: false },
    gameDataManagerRef: { current: null },
    keyboardEventsManagerRef: {
      current: { HandleKeyboardEventDown: vi.fn(), HandleKeyboardEventUp: vi.fn() },
    },
    forceUpdate: vi.fn(),
    isGM: false,
  }),
}));

vi.mock('./hooks/useGameApi', () => ({ useGameApi: vi.fn() }));
vi.mock('./hooks/useGameEventHandlers', () => ({
  useGameEventHandlers: () => ({
    HandleShowLayout: vi.fn(),
    HandleSettingsChange: vi.fn(),
    HandlePlayers: vi.fn(),
    HandleError: vi.fn(),
    HandleShowPanel: vi.fn(),
    HandleShowCard: vi.fn(),
    HandleShowView: vi.fn(),
    HandleViewShow: vi.fn(),
    HandleAddMenuItem: vi.fn(),
    HandleAddToolbarButton: vi.fn(),
    HandleFireClientMediator: vi.fn(),
  }),
}));

import { ActiveTransportManager as WebSocketManagerInstance } from '../../helpers/transport';
import { Game } from './Game';

// Regression coverage for the Retry button: WebSocketManagerInstance.WebSocketStarted
// is a directly-mutated class field, and forceReconnect() flips it false→true
// synchronously in one tick (Close() then Start()), so React's effect-dependency
// diff never observes an intermediate value — the mount effect that used to be
// the only thing calling loadGame() never re-fires. Retry must call loadGame()
// directly instead of relying on that effect.
describe('Game — Retry button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls loadGame() directly when Retry is clicked, not just resetInitialization/forceReconnect', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Game gameID="game-1" onExit={vi.fn()} centralSessionId="session-1" onAuthFailure={vi.fn()} />
    );

    const retryButton = await screen.findByRole('button', { name: /retry/i });
    expect(loadGameMock).not.toHaveBeenCalled();

    await user.click(retryButton);

    expect(resetInitializationMock).toHaveBeenCalledTimes(1);
    expect(WebSocketManagerInstance.forceReconnect).toHaveBeenCalledTimes(1);
    expect(loadGameMock).toHaveBeenCalledTimes(1);
  });
});
