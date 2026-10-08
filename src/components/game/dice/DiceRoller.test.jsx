import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '../../../setupTests';

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
vi.mock('../../../helpers/transport', () => ({
  ActiveTransportManager: { Send: sendMock },
}));

import DiceRoller from './DiceRoller';

const formula = () => screen.getByTestId('dice-formula').textContent;

describe('DiceRoller', () => {
  beforeEach(() => {
    sendMock.mockClear();
  });

  it('builds the /r command from clicked dice and the modifier', () => {
    renderWithProviders(<DiceRoller />);

    fireEvent.click(screen.getByRole('button', { name: 'Add d20' }));
    fireEvent.change(screen.getByLabelText('Modifier'), { target: { value: '5' } });

    expect(formula()).toBe('/r 1d20+5');
  });

  it('turns a d20 into 2d20kh1 with advantage', () => {
    renderWithProviders(<DiceRoller />);

    fireEvent.click(screen.getByRole('button', { name: 'Add d20' }));
    fireEvent.change(screen.getByLabelText('Modifier'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Advantage' }));

    expect(formula()).toBe('/r 2d20kh1+5');
  });

  it('sends the roll to chat and calls onRolled', () => {
    const onRolled = vi.fn();
    renderWithProviders(<DiceRoller onRolled={onRolled} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add d20' }));
    fireEvent.change(screen.getByLabelText('Modifier'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Advantage' }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));

    expect(sendMock).toHaveBeenCalledWith({ command: 'chat_push', data: '/r 2d20kh1+5' });
    expect(onRolled).toHaveBeenCalledTimes(1);
  });

  it('accepts a typed negative modifier', () => {
    renderWithProviders(<DiceRoller />);
    fireEvent.click(screen.getByRole('button', { name: 'Add d20' }));

    fireEvent.change(screen.getByLabelText('Modifier'), { target: { value: '-' } });
    expect(screen.getByLabelText('Modifier').value).toBe('-');
    fireEvent.change(screen.getByLabelText('Modifier'), { target: { value: '-2' } });

    expect(formula()).toBe('/r 1d20-2');
  });

  it('removes one die with its chip (no right-click needed)', () => {
    renderWithProviders(<DiceRoller />);
    fireEvent.click(screen.getByRole('button', { name: 'Add d8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add d8' }));

    fireEvent.click(screen.getByRole('button', { name: 'Remove d8' }));

    expect(formula()).toBe('/r 1d8');
  });

  it('disables Roll while the pool is empty', () => {
    renderWithProviders(<DiceRoller />);
    expect(screen.getByRole('button', { name: 'Roll' }).disabled).toBe(true);
  });

  it('removes a die with right-click and clears the pool', () => {
    renderWithProviders(<DiceRoller />);
    const d6 = screen.getByRole('button', { name: 'Add d6' });

    fireEvent.click(d6);
    fireEvent.click(d6);
    fireEvent.contextMenu(d6);
    expect(formula()).toBe('/r 1d6');

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByRole('button', { name: 'Roll' }).disabled).toBe(true);
  });

  it('disables keep/drop for a mixed pool and enables it for one die type', () => {
    renderWithProviders(<DiceRoller />);
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));

    fireEvent.click(screen.getByRole('button', { name: 'Add d6' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add d8' }));
    expect(screen.getByLabelText('Keep or drop').disabled).toBe(true);

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Add d8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add d6' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add d6' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add d6' }));
    const keepDrop = screen.getByLabelText('Keep or drop');
    expect(keepDrop.disabled).toBe(false);

    fireEvent.change(keepDrop, { target: { value: 'dl' } });
    expect(formula()).toBe('/r 4d6dl1');
  });

  it('adds exploding and count successes', () => {
    renderWithProviders(<DiceRoller />);
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole('button', { name: 'Add d10' }));

    fireEvent.click(screen.getByRole('button', { name: 'Exploding dice' }));
    fireEvent.change(screen.getByLabelText('Count'), { target: { value: 'cs' } });
    fireEvent.change(screen.getByLabelText('Target'), { target: { value: '7' } });

    expect(formula()).toBe('/r 10d10!cs>7');
  });
});
