import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '../../setupTests';
import { MaterialChooser } from './MaterialChooser';

vi.mock('./base/Subscribable', () => ({ default: () => null }));

vi.mock('../../helpers/transport', () => ({
  ActiveWebHelper: { getAsync: vi.fn(), get: vi.fn() },
  ActiveTransportManager: { Subscribe: vi.fn(), Unsubscribe: vi.fn(), Send: vi.fn(), WebSocketReady: true },
}));

vi.mock('../../ClientMediator', () => ({
  default: { on: vi.fn(() => vi.fn()), off: vi.fn() },
}));

import { ActiveWebHelper } from '../../helpers/transport';

const MATERIALS = [
  { id: 'a', name: 'base.css', mimeType: 'text/css' },
  { id: 'b', name: 'dark.css', mimeType: 'text/css' },
  { id: 'c', name: 'map.png', mimeType: 'image/png' },
];

const shownNames = () =>
  screen.getAllByText(/\.css$/).map((el) => el.textContent);

describe('MaterialChooser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ActiveWebHelper.getAsync.mockResolvedValue(MATERIALS);
  });

  // Order matters for stylesheets (later ones win), so the selection is shown
  // in the order given, not in the order of the materials list.
  it('shows selected materials in the given order', async () => {
    renderWithProviders(<MaterialChooser multipleSelection materialsSelected={['b', 'a']} />);

    await waitFor(() => expect(shownNames()).toEqual(['dark.css', 'base.css']));
  });

  it('orderable: moving an item reports the new order', async () => {
    const onSelect = vi.fn();
    renderWithProviders(<MaterialChooser multipleSelection orderable materialsSelected={['b', 'a']} onSelect={onSelect} />);
    await waitFor(() => expect(shownNames()).toEqual(['dark.css', 'base.css']));

    await userEvent.click(screen.getAllByRole('button', { name: 'Move up' })[1]);

    expect(onSelect).toHaveBeenLastCalledWith(['a', 'b']);
  });

  it('has no move buttons unless orderable', async () => {
    renderWithProviders(<MaterialChooser multipleSelection materialsSelected={['b', 'a']} />);
    await waitFor(() => expect(shownNames()).toHaveLength(2));

    expect(screen.queryByRole('button', { name: 'Move up' })).toBeNull();
  });

  // Both the list of chosen items and the checkboxes in the picker marked the same
  // selection. The list now shows only while the picker is closed.
  it('chosen items show while the picker is closed, not while it is open', async () => {
    renderWithProviders(<MaterialChooser multipleSelection materialsSelected={['a']} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove base.css' })).toBeTruthy());

    await userEvent.click(screen.getByRole('button', { name: /change/i }));
    expect(screen.queryByRole('button', { name: 'Remove base.css' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: 'Remove base.css' })).toBeTruthy();
  });

  // Addon templates point at their resources by key (e.g. a card's "token" property is
  // "roll20compat_token_generic.json"), which the token code accepts; the chooser only
  // matched ids, so the card's token showed as not selected.
  it('shows a material selected by its key', async () => {
    ActiveWebHelper.getAsync.mockResolvedValue([
      ...MATERIALS,
      { id: 't', name: 'token_generic.json', key: 'roll20compat_token_generic.json', mimeType: 'application/json' },
    ]);

    renderWithProviders(<MaterialChooser materialsSelected="roll20compat_token_generic.json" />);

    expect(await screen.findByRole('button', { name: 'Remove token_generic.json' })).toBeTruthy();
  });
});
