import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

// Mock MainApp so the full game/WebRTC/dockable dependency chain
// is not imported during auth-flow tests.
vi.mock('./components/MainApp', () => ({
  MainApp: () => <div data-testid="main-app" />,
}));

// Mock WebHelper API calls made during auth checks.
vi.mock('./helpers/WebHelper', () => ({
  default: {
    getAsync: vi.fn().mockResolvedValue({}),
    getNoResp: vi.fn(),
    post: vi.fn(),
    getResourceString: vi.fn((path) => path),
  },
}));

// Import after mocks are registered.
import App from './App';
import WebHelper from './helpers/WebHelper';

describe('App — auth routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading indicator while checking auth', () => {
    // getNoResp never calls back — simulates an in-flight request.
    WebHelper.getNoResp.mockImplementation(() => {});
    render(<App />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows the Login panel when the user is not authenticated', async () => {
    // Simulate a failed auth check by invoking the error callback.
    WebHelper.getNoResp.mockImplementation((_url, _onOk, onError) => {
      onError();
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
    });
  });

  it('shows MainApp when the user is authenticated', async () => {
    // Simulate a successful auth check by invoking the success callback.
    WebHelper.getNoResp.mockImplementation((_url, onSuccess) => {
      onSuccess();
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('main-app')).toBeInTheDocument();
    });
  });
});
