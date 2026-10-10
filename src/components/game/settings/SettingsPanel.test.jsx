import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
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
