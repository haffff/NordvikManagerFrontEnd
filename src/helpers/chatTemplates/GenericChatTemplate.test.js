import { screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../setupTests';
import { GenericChatTemplate } from './GenericChatTemplate';

describe('GenericChatTemplate', () => {
  it('renders nothing when both title and message are missing', () => {
    const { container } = renderWithProviders(<GenericChatTemplate object={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the title and message when present (e.g. dnd5e.DisplaySpellDescription output)', () => {
    renderWithProviders(
      <GenericChatTemplate
        object={{
          title: 'Fireball (3rd Evocation)',
          message: 'Casting Time: 1 action   Range: 150 ft.   Duration: Instantaneous\nComponents: V, S, M\n\nA bright flash...',
        }}
      />
    );

    expect(screen.getByText('Fireball (3rd Evocation)')).toBeInTheDocument();
    expect(screen.getByText(/A bright flash/)).toBeInTheDocument();
  });

  it('renders just the title when there is no message', () => {
    renderWithProviders(<GenericChatTemplate object={{ title: 'Only a title' }} />);
    expect(screen.getByText('Only a title')).toBeInTheDocument();
  });
});
