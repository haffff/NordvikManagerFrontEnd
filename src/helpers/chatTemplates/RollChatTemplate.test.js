import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '../../setupTests';

const sendMock = vi.fn();
vi.mock('../transport', () => ({
  ActiveTransportManager: { Send: (...args) => sendMock(...args) },
}));

import { RollChatTemplate } from './RollChatTemplate';

const baseRoll = { result: 17, rolled: '{0}+3', dices: [{ index: 0, diceValue: 20, times: 1, result: 14 }] };

describe('RollChatTemplate', () => {
  beforeEach(() => {
    sendMock.mockClear();
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

  it('renders a follow-up action button and fires execute_action with its baked-in args on click', () => {
    const actions = [
      { label: 'Roll Damage', actionName: 'dnd5e.roll_damage', args: { damage: '1d6+3', damageType: 'Slashing', name: 'Longsword' } },
    ];
    renderWithProviders(<RollChatTemplate object={{ title: 'Longsword — Attack', roll: baseRoll, actions }} />);

    const button = screen.getByRole('button', { name: 'Roll Damage' });
    fireEvent.click(button);

    expect(sendMock).toHaveBeenCalledWith({
      command: 'execute_action',
      data: { Action: 'dnd5e.roll_damage', Args: { damage: '1d6+3', damageType: 'Slashing', name: 'Longsword' } },
    });
  });

  it('disables the button after it has been clicked once, to guard against double-rolling', () => {
    const actions = [{ label: 'Roll Damage', actionName: 'dnd5e.roll_damage', args: {} }];
    renderWithProviders(<RollChatTemplate object={{ roll: baseRoll, actions }} />);

    const button = screen.getByRole('button', { name: 'Roll Damage' });
    fireEvent.click(button);

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
  });
});
