import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../setupTests';

vi.mock('../../helpers/WebHelper', () => ({ default: { getAsync: vi.fn(), post: vi.fn() } }));

import WebHelper from '../../helpers/WebHelper';
import { CreateNewDialog } from './CreateNewDialog';

const ADDONS = [
  { key: 'basics', name: 'Basics', description: 'Tokens and notes', builtIn: true },
  { key: 'dnd5e', name: 'D&D 5E' },
];

async function openDialog() {
  renderWithProviders(<CreateNewDialog OnSuccess={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: /Create new game/ }));
  await screen.findByText('Basics');
}

const checkbox = (name) => screen.getByRole('checkbox', { name: new RegExp(name) });

async function submit() {
  fireEvent.input(screen.getByPlaceholderText('My epic adventure'), { target: { value: 'Campaign' } });
  await userEvent.click(screen.getByRole('button', { name: /Create game/ }));
  await waitFor(() => expect(WebHelper.post).toHaveBeenCalled());
  return WebHelper.post.mock.calls[0][1];
}

describe('CreateNewDialog, add-ons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    WebHelper.getAsync.mockResolvedValue(ADDONS);
  });

  it('built-in add-ons are ticked by default and sent with the new game', async () => {
    await openDialog();

    expect(checkbox('Basics')).toBeChecked();
    expect(checkbox('D&D 5E')).not.toBeChecked();
    expect((await submit()).addonsSelected).toEqual(['basics']);
  });

  it('a built-in add-on can be unticked', async () => {
    await openDialog();

    await userEvent.click(checkbox('Basics'));

    expect(checkbox('Basics')).not.toBeChecked();
    expect((await submit()).addonsSelected).toEqual([]);
  });

  it('a registry add-on can be ticked alongside', async () => {
    await openDialog();

    await userEvent.click(checkbox('D&D 5E'));

    expect((await submit()).addonsSelected).toEqual(['basics', 'dnd5e']);
  });
});
