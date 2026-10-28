import { describe, it, expect } from 'vitest';
import { parseColor } from '@chakra-ui/react';
import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../setupTests';
import { withVisibleAlpha, DColorPicker, DEFAULT_COLOR } from './ColorPicker';

// An unset colour starts fully transparent; picking a colour there used to keep
// alpha at 0, so whatever was picked stayed invisible.
describe('withVisibleAlpha', () => {
  const alpha = (c) => c.getChannelValue('alpha');

  it('makes a colour picked while fully transparent opaque', () => {
    const next = withVisibleAlpha(parseColor('rgba(0,0,0,0)'), parseColor('rgba(255,0,0,0)'));
    expect(alpha(next)).toBe(1);
    expect(next.toString('rgba')).toBe('rgba(255, 0, 0, 1)');
  });

  it('keeps an alpha the user is setting with the slider', () => {
    expect(alpha(withVisibleAlpha(parseColor('rgba(0,0,0,0)'), parseColor('rgba(0,0,0,0.4)')))).toBe(0.4);
  });

  it('lets the user make an opaque colour fully transparent', () => {
    expect(alpha(withVisibleAlpha(parseColor('rgba(255,0,0,1)'), parseColor('rgba(255,0,0,0)')))).toBe(0);
  });
});

// An unset colour field opens the picker at opaque black (not alpha 0), and says
// it's unset rather than showing a colour that was never chosen.
describe('DColorPicker', () => {
  it('without a colour: says "Not set" and starts opaque', () => {
    renderWithProviders(<DColorPicker />);

    expect(screen.getByText('Not set')).toBeTruthy();
    expect(screen.queryByText('rgba(0, 0, 0, 0)')).toBeNull();
    expect(DEFAULT_COLOR).toBe('rgba(0,0,0,1)');
  });

  it('with a colour: shows it', () => {
    renderWithProviders(<DColorPicker initColor="rgba(255,0,0,1)" />);

    expect(screen.queryByText('Not set')).toBeNull();
  });
});
