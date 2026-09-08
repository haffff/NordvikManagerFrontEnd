import { vi, describe, it, expect, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../setupTests';

vi.mock('../../helpers/WebHelper', () => ({ default: { postAsync: vi.fn() } }));
vi.mock('../ui/toaster', () => ({ toaster: { create: vi.fn() } }));

import WebHelper from '../../helpers/WebHelper';
import { toaster } from '../ui/toaster';
import { JoinDialog } from './JoinDialog';

// Regression coverage: WebHelper.postAsync returns undefined (not a rejected
// promise) on a network error. onFormSubmit accessed result.ok unguarded,
// throwing and silently aborting — no error toast, no visible feedback — on both
// the manual join form and this auto-join-by-invite-link flow.
describe('JoinDialog — auto-join by invite link', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
    vi.clearAllMocks();
  });

  it('shows an error toast instead of throwing when postAsync resolves undefined (network error)', async () => {
    window.history.pushState({}, '', '/?code=abc123');
    WebHelper.postAsync.mockResolvedValue(undefined);
    const onSuccess = vi.fn();

    renderWithProviders(<JoinDialog OnSuccess={onSuccess} />);

    await waitFor(() =>
      expect(WebHelper.postAsync).toHaveBeenCalledWith('gamelist/join', { gameID: 'abc123' })
    );
    await waitFor(() => expect(toaster.create).toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('still succeeds normally when postAsync resolves ok', async () => {
    window.history.pushState({}, '', '/?code=abc123');
    WebHelper.postAsync.mockResolvedValue({ ok: true });
    const onSuccess = vi.fn();

    renderWithProviders(<JoinDialog OnSuccess={onSuccess} />);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('abc123'));
    expect(toaster.create).not.toHaveBeenCalled();
  });
});
