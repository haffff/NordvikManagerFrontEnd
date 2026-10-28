import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '../../setupTests';

const sendCommandMock = vi.fn();
vi.mock('../../ClientMediator', () => ({
  default: { sendCommand: (...args) => sendCommandMock(...args) },
}));

import { RollChatTemplate } from './RollChatTemplate';

const baseRoll = { result: 17, rolled: '{0}+3', dices: [{ index: 0, diceValue: 20, times: 1, result: 14 }] };

describe('RollChatTemplate', () => {
  beforeEach(() => {
    sendCommandMock.mockClear();
  });

  it('renders nothing when object.roll is missing', () => {
    const { container } = renderWithProviders(<RollChatTemplate object={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the roll total and title without any action buttons when none are attached', () => {
    renderWithProviders(<RollChatTemplate object={{ title: 'Strength Check', roll: baseRoll }} />);

    expect(screen.getByText('Strength Check')).toBeInTheDocument();
    expect(screen.getByText('17')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a follow-up action button and fires Action.Run with its baked-in args on click', () => {
    const actions = [
      { label: 'Roll Damage', actionName: 'dnd5e.roll_damage', args: { damage: '1d6+3', damageType: 'Slashing', name: 'Longsword' } },
    ];
    renderWithProviders(<RollChatTemplate object={{ title: 'Longsword — Attack', roll: baseRoll, actions }} />);

    const button = screen.getByRole('button', { name: 'Roll Damage' });
    fireEvent.click(button);

    expect(sendCommandMock).toHaveBeenCalledWith('Action', 'Run', {
      name: 'dnd5e.roll_damage',
      args: { damage: '1d6+3', damageType: 'Slashing', name: 'Longsword' },
    });
  });

  it('disables the button after it has been clicked once, to guard against double-rolling', () => {
    const actions = [{ label: 'Roll Damage', actionName: 'dnd5e.roll_damage', args: {} }];
    renderWithProviders(<RollChatTemplate object={{ roll: baseRoll, actions }} />);

    const button = screen.getByRole('button', { name: 'Roll Damage' });
    fireEvent.click(button);

    expect(sendCommandMock).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
  });
});
