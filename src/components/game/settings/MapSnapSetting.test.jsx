import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '../../../setupTests';
import { MapSnapSetting } from './MapSnapSetting';
import { getSnapSettings } from '../../../helpers/mapSnapSettings';

describe('MapSnapSetting', () => {
  beforeEach(() => localStorage.clear());

  const row = (name) => screen.getByRole('group', { name });

  it('shows the defaults: moving snaps (Alt skips), scaling snaps while Ctrl is held', () => {
    renderWithProviders(<MapSnapSetting />);

    const move = row('Moving');
    expect(move.querySelector('[aria-pressed="true"][data-mode="always"]')).not.toBeNull();
    expect(move.querySelector('[aria-pressed="true"][data-key="Alt"]')).not.toBeNull();
    const scale = row('Scaling');
    expect(scale.querySelector('[aria-pressed="true"][data-mode="hold"]')).not.toBeNull();
    expect(scale.querySelector('[aria-pressed="true"][data-key="Ctrl"]')).not.toBeNull();
  });

  it('picking a mode or a key saves it', () => {
    renderWithProviders(<MapSnapSetting />);

    fireEvent.click(row('Scaling').querySelector('[data-key="Shift"]'));
    fireEvent.click(row('Moving').querySelector('[data-mode="never"]'));

    expect(getSnapSettings()).toEqual({ move: { mode: 'never', key: 'Alt' }, scale: { mode: 'hold', key: 'Shift' } });
    expect(row('Moving').querySelector('[data-key="Alt"]')).toBeDisabled(); // no key matters when it never snaps
  });
});
