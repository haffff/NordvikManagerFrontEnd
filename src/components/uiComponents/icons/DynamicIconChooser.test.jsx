import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../../setupTests';

// A small stand-in for react-icons/gi: a few named icons plus enough generated ones
// to go past what "More..." shows.
vi.mock('react-icons/gi', () => {
  const icon = (name) => (props) => <svg data-icon={name} {...props} />;
  const mod = {
    GiDragonHead: icon('GiDragonHead'),
    GiBroadsword: icon('GiBroadsword'),
    GiSword: icon('GiSword'),
  };
  for (let i = 0; i < 400; i++) mod[`GiFiller${i}`] = icon(`GiFiller${i}`);
  return mod;
});

vi.mock('../../../helpers/ReactIconPackLoaders', () => ({
  ICON_PACK_LOADERS: { gi: () => import('react-icons/gi') },
}));

import { DynamicIconChooser } from './DynamicIconChooser';

const openPicker = async () => {
  await userEvent.click(screen.getByRole('button', { name: /select icon|change icon/i }));
  await screen.findByRole('button', { name: 'GiSword' });
};

describe('DynamicIconChooser', () => {
  // The folder dialog stays mounted between opens, so the chooser must follow its value.
  it('follows the value it is given', async () => {
    const { rerender } = renderWithProviders(<DynamicIconChooser iconSelected="GiSword" />);
    expect(screen.getByText('GiSword')).toBeTruthy();

    rerender(<DynamicIconChooser iconSelected="GiDragonHead" />);
    expect(await screen.findByText('GiDragonHead')).toBeTruthy();

    rerender(<DynamicIconChooser iconSelected="" />);
    await waitFor(() => expect(screen.queryByText('GiDragonHead')).toBeNull());
    expect(screen.getByRole('button', { name: 'Select Icon' })).toBeTruthy();
  });

  it('isDisabled disables it', () => {
    renderWithProviders(<DynamicIconChooser iconSelected="GiSword" isDisabled />);

    expect(screen.getByRole('button', { name: 'Change Icon' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Remove icon' }).disabled).toBe(true);
  });

  it('picking an icon reports it and closes the grid', async () => {
    const onSelect = vi.fn();
    renderWithProviders(<DynamicIconChooser onSelect={onSelect} />);
    await openPicker();

    await userEvent.click(screen.getByRole('button', { name: 'GiSword' }));

    expect(onSelect).toHaveBeenCalledWith('GiSword');
    expect(screen.queryByRole('button', { name: 'GiDragonHead' })).toBeNull();
    expect(screen.getByText('GiSword')).toBeTruthy();
  });

  it('search ignores case', async () => {
    renderWithProviders(<DynamicIconChooser />);
    await openPicker();

    await userEvent.type(screen.getByRole('textbox', { name: /search icons/i }), 'dragon');

    expect(screen.getByRole('button', { name: 'GiDragonHead' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'GiSword' })).toBeNull();
  });

  it('the current icon is marked in the grid', async () => {
    renderWithProviders(<DynamicIconChooser iconSelected="GiSword" />);
    await openPicker();

    expect(screen.getByRole('button', { name: 'GiSword' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'GiBroadsword' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('Close leaves without changing anything', async () => {
    const onSelect = vi.fn();
    renderWithProviders(<DynamicIconChooser iconSelected="GiSword" onSelect={onSelect} />);
    await openPicker();

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'GiBroadsword' })).toBeNull();
    expect(screen.getByText('GiSword')).toBeTruthy();
  });

  // Empty string, not null: the tree update keeps the old icon when it gets null.
  it('Remove icon clears it', async () => {
    const onSelect = vi.fn();
    renderWithProviders(<DynamicIconChooser iconSelected="GiSword" onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove icon' }));

    expect(onSelect).toHaveBeenCalledWith('');
    expect(screen.queryByText('GiSword')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove icon' })).toBeNull();
  });

  it('"More..." shows a capped number and says to search for the rest', async () => {
    renderWithProviders(<DynamicIconChooser />);
    await openPicker();

    await userEvent.click(screen.getByRole('button', { name: 'More...' }));

    const shown = screen.getAllByRole('button', { name: /^Gi/ });
    expect(shown).toHaveLength(300);
    expect(screen.getByText(/Showing 300 of 403/)).toBeTruthy();
  });
});
