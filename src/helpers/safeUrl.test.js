import { describe, it, expect } from 'vitest';
import { safeExternalUrl } from './safeUrl';

// Links from addon metadata (website, repository) and similar outside data open in a
// new tab. Only http(s) URLs may: a javascript: link would run in the app's origin.
describe('safeExternalUrl', () => {
  it.each([
    ['https://github.com/haffff/addon', 'https://github.com/haffff/addon'],
    ['http://example.com/x?y=1#z', 'http://example.com/x?y=1#z'],
    ['  https://example.com  ', 'https://example.com/'],
  ])('keeps %s', (input, expected) => {
    expect(safeExternalUrl(input)).toBe(expected);
  });

  it.each([
    ['javascript:alert(1)'],
    [' JavaScript:alert(1)'],
    ['data:text/html,<script>alert(1)</script>'],
    ['vbscript:x'],
    ['/relative/path'],
    ['example.com'],
    [''],
    [null],
    [undefined],
    [{ toString: () => 'javascript:alert(1)' }],
  ])('rejects %s', (input) => {
    expect(safeExternalUrl(input)).toBeNull();
  });
});
