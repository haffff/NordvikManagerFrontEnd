import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../setupTests';
import SettingsPanel from './SettingsPanel';

// Each setting sits on a card. Its colours were fixed (dark grey, white text), so a
// light game theme showed grey boxes; they now come from the theme variables, with
// the old colours as the fallback when no theme sets them.
describe('SettingsPanel field cards', () => {
  it('take their background and text colour from the theme variables', () => {
    renderWithProviders(
      <SettingsPanel
        dto={{ id: 'x', name: 'Goblin' }}
        editableKeyLabelDict={[{ key: 'name', label: 'Card name', type: 'string' }]}
      />
    );

    const card = screen.getByTestId('setting-card-name');
    expect(card).toHaveAttribute('style', expect.stringContaining('var(--nordvik-surface-card, rgba(40,40,40,0.5))'));
    expect(card).toHaveAttribute('style', expect.stringContaining('var(--nordvik-text-color, white)'));
  });
});

// A short fixed choice shown as a row of joined buttons, all options visible at once.
describe('SettingsPanel segmented field', () => {
  const field = {
    key: 'mask_hp_mode',
    label: 'HP bar',
    type: 'segmented',
    options: [
      { value: 'notset', label: 'Not set' },
      { value: 'visible', label: 'Visible' },
      { value: 'hidden', label: 'Hidden' },
    ],
  };

  it('shows every option and marks the current one', () => {
    renderWithProviders(
      <SettingsPanel dto={{ id: 'x', mask_hp_mode: 'visible' }} editableKeyLabelDict={[field]} />
    );

    expect(screen.getByRole('button', { name: 'Visible' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Not set' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Hidden' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('saves the picked option', () => {
    const onSave = vi.fn();
    renderWithProviders(
      <SettingsPanel dto={{ id: 'x', mask_hp_mode: 'visible' }} editableKeyLabelDict={[field]} onSave={onSave} saveOnLeave />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hidden' }));

    expect(screen.getByRole('button', { name: 'Hidden' })).toHaveAttribute('aria-pressed', 'true');
    expect(onSave).toHaveBeenLastCalledWith({ mask_hp_mode: 'hidden' });
  });
});
