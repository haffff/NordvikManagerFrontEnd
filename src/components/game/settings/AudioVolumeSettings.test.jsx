import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '../../../setupTests';
import { getVolume, setVolume } from '../../../helpers/audioVolume';
import { AudioVolumeSettings } from './AudioVolumeSettings';

describe('AudioVolumeSettings', () => {
  beforeEach(() => localStorage.clear());

  it('has a slider for music, sound effects and notifications, showing the current volume', () => {
    setVolume('music', 0.4);

    renderWithProviders(<AudioVolumeSettings />);

    expect(screen.getByRole('slider', { name: 'Music volume' })).toHaveValue('40');
    expect(screen.getByRole('slider', { name: 'Sound effects volume' })).toHaveValue('100');
    expect(screen.getByRole('slider', { name: 'Notifications volume' })).toHaveValue('100');
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('moving a slider sets that volume (0 mutes)', () => {
    renderWithProviders(<AudioVolumeSettings />);

    fireEvent.change(screen.getByRole('slider', { name: 'Sound effects volume' }), { target: { value: '0' } });

    expect(getVolume('sounds')).toBe(0);
    expect(screen.getByText('Muted')).toBeInTheDocument();
  });
});
