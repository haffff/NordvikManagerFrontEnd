import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithProviders } from '../../setupTests';
import { LoginPanel } from './LoginPanel';

vi.mock('../../helpers/WebHelper', () => ({
  default: {
    post: vi.fn(),
    getResourceString: vi.fn((path) => path),
  },
}));

vi.mock('../ui/toaster', () => ({
  toaster: { create: vi.fn() },
}));

import WebHelper from '../../helpers/WebHelper';

describe('LoginPanel', () => {
  const onSuccess = vi.fn();
  const onRegister = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form fields', () => {
    renderWithProviders(<LoginPanel OnSuccess={onSuccess} />);

    expect(screen.getByPlaceholderText(/login/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('does not show "Create an account" button when onRegister is not provided', () => {
    renderWithProviders(<LoginPanel OnSuccess={onSuccess} />);
    expect(screen.queryByText(/create an account/i)).not.toBeInTheDocument();
  });

  it('shows "Create an account" button when onRegister is provided', () => {
    renderWithProviders(<LoginPanel OnSuccess={onSuccess} onRegister={onRegister} />);
    expect(screen.getByRole('button', { name: /create an account/i })).toBeInTheDocument();
  });

  it('calls onRegister when "Create an account" is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPanel OnSuccess={onSuccess} onRegister={onRegister} />);

    await user.click(screen.getByRole('button', { name: /create an account/i }));
    expect(onRegister).toHaveBeenCalledTimes(1);
  });

  it('calls WebHelper.post with credentials on login button click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPanel OnSuccess={onSuccess} />);

    await user.type(screen.getByPlaceholderText(/login/i), 'testuser');
    await user.type(screen.getByPlaceholderText(/enter password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /login/i }));

    expect(WebHelper.post).toHaveBeenCalledWith(
      'User/login',
      { UserName: 'testuser', password: 'secret' },
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('calls OnSuccess when login succeeds', async () => {
    const user = userEvent.setup();
    WebHelper.post.mockImplementation((_url, _body, onSuccess) => {
      onSuccess({ token: 'abc' });
    });

    renderWithProviders(<LoginPanel OnSuccess={onSuccess} />);

    await user.type(screen.getByPlaceholderText(/login/i), 'testuser');
    await user.type(screen.getByPlaceholderText(/enter password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });
});
