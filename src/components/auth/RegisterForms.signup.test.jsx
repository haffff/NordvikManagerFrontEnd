import { screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createChallenge, verifySolution } from 'altcha-lib/v1';
import { renderWithProviders } from '../../setupTests';

// Both register forms (the player client's, straight to Central, and the GM app's, through
// the GM server) solve Central's signup puzzle while the user types, send the answer and
// the hidden honeypot field, and take a fresh puzzle after a failed try (an answer counts
// once).

vi.mock('../../helpers/CentralWebHelper', () => ({ default: { getAsync: vi.fn(), postAsync: vi.fn() } }));
vi.mock('../../helpers/WebHelper', () => ({ default: { getAsync: vi.fn(), postAsync: vi.fn(), getResourceString: vi.fn((p) => p) } }));
vi.mock('../ui/toaster', () => ({ toaster: { create: vi.fn() } }));
vi.mock('../../helpers/TokenStore', () => ({ default: { clear: vi.fn(), setAccessToken: vi.fn() } }));

import CentralWebHelper from '../../helpers/CentralWebHelper';
import WebHelper from '../../helpers/WebHelper';
import { PlayerRegisterForm } from './PlayerRegisterForm';
import { RegisterForm } from '../gameLobby/RegisterForm';

const answer = (resp) => ({ ok: resp.status < 300, status: resp.status, json: async () => resp.body });

const fill = (placeholders) => {
  for (const [placeholder, value] of Object.entries(placeholders))
    for (const input of screen.getAllByPlaceholderText(placeholder)) fireEvent.input(input, { target: { value } });
};

const forms = [
  {
    name: 'player client',
    helper: () => CentralWebHelper,
    challengePath: 'user/signupchallenge',
    render: () => renderWithProviders(<PlayerRegisterForm requiresCode={false} OnSuccess={vi.fn()} />),
    fill: () => fill({ Username: 'hero', Password: 'secret-pw', 'Confirm password': 'secret-pw' }),
    failure: { status: 409, body: { error: 'Username already taken' } },
  },
  {
    name: 'GM app',
    helper: () => WebHelper,
    challengePath: 'user/SignupChallenge',
    render: () => renderWithProviders(<RegisterForm requiresCode={false} />),
    fill: () => fill({ Login: 'hero', 'Enter password': 'secret-pw' }),
    failure: { status: 400, body: { message: 'Username already taken' } },
  },
];

describe.each(forms)('$name register form', (form) => {
  let challenges;

  beforeEach(async () => {
    vi.clearAllMocks();
    challenges = [];
    form.helper().getAsync.mockImplementation(async (path) => {
      if (path !== form.challengePath) return undefined;
      const challenge = await createChallenge({ hmacKey: 'k', maxNumber: 200 });
      challenges.push(challenge);
      return { ...challenge, minAgeMs: 0 };
    });
  });

  const submit = () => fireEvent.click(screen.getByRole('button', { name: /register/i }));
  const lastBody = () => form.helper().postAsync.mock.calls.at(-1)[1];

  it('sends the solved puzzle and an empty hidden field', async () => {
    form.helper().postAsync.mockResolvedValue(answer(form.failure));
    form.render();
    form.fill();

    submit();

    await waitFor(() => expect(form.helper().postAsync).toHaveBeenCalled());
    const body = lastBody();
    expect(body.nmTrapField).toBe('');
    const payload = JSON.parse(atob(body.altcha));
    expect(payload.signature).toBe(challenges[0].signature);
    expect(await verifySolution(payload, 'k')).toBe(true);
  });

  it('takes a fresh puzzle after a failed try', async () => {
    form.helper().postAsync.mockResolvedValue(answer(form.failure));
    form.render();
    form.fill();
    submit();
    await waitFor(() => expect(form.helper().postAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(challenges.length).toBe(2));

    submit();

    await waitFor(() => expect(form.helper().postAsync).toHaveBeenCalledTimes(2));
    expect(JSON.parse(atob(lastBody().altcha)).signature).toBe(challenges[1].signature);
  });

  it('registers without a puzzle when the server offers none', async () => {
    form.helper().getAsync.mockResolvedValue(undefined);
    form.helper().postAsync.mockResolvedValue(answer(form.failure));
    form.render();
    form.fill();

    submit();

    await waitFor(() => expect(form.helper().postAsync).toHaveBeenCalled());
    expect(lastBody().altcha).toBeUndefined();
  });
});
