import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '../../setupTests';
import { VolumeSlider } from './VolumeSlider';

describe('VolumeSlider', () => {
  it('shows the volume as a percentage', () => {
    renderWithProviders(<VolumeSlider label="Volume of Tavern" value={0.8} onCommit={vi.fn()} />);

    expect(screen.getByRole('slider', { name: 'Volume of Tavern' })).toHaveValue('80');
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('saves when let go, not on every step of the drag', () => {
    const onCommit = vi.fn();
    renderWithProviders(<VolumeSlider label="Volume of Tavern" value={1} onCommit={onCommit} />);
    const slider = screen.getByRole('slider', { name: 'Volume of Tavern' });

    fireEvent.change(slider, { target: { value: '70' } });
    fireEvent.change(slider, { target: { value: '50' } });
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.pointerUp(slider);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(0.5);
  });

  it('keyboard changes save too, and an unchanged value is not saved again', () => {
    const onCommit = vi.fn();
    renderWithProviders(<VolumeSlider label="Volume of Tavern" value={1} onCommit={onCommit} />);
    const slider = screen.getByRole('slider', { name: 'Volume of Tavern' });

    fireEvent.keyUp(slider, { key: 'ArrowLeft' });
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.change(slider, { target: { value: '95' } });
    fireEvent.keyUp(slider, { key: 'ArrowLeft' });
    expect(onCommit).toHaveBeenCalledWith(0.95);
  });
});
