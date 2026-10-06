import { describe, it, expect } from 'vitest';
import { parseColor } from '@chakra-ui/react';
import { withVisibleAlpha } from './ColorPicker';

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
