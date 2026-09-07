import { vi, describe, it, expect } from 'vitest';

const convertBlobToB64 = vi.fn();
vi.mock('./UtilityHelper', () => ({
  default: { ConvertBlobToB64: (...args) => convertBlobToB64(...args) },
}));

import WebHelper from './WebHelper';

// Regression coverage for the missing .catch() on postMaterial's promise chain —
// a FileReader failure inside ConvertBlobToB64 used to produce an unhandled
// rejection and never call onerror/onException. Mirrors the same fix in
// WebRTCWebHelper.postMaterial.
describe('WebHelper.postMaterial', () => {
  it('calls onException when ConvertBlobToB64 rejects', async () => {
    const error = new Error('FileReader failed');
    convertBlobToB64.mockRejectedValue(error);
    const onException = vi.fn();

    WebHelper.postMaterial({ name: 'a.png', type: 'image/png' }, vi.fn(), vi.fn(), onException);
    await new Promise((r) => setTimeout(r, 0));

    expect(onException).toHaveBeenCalledWith(error);
  });

  it('falls back to console.error when no onException handler is given', async () => {
    const error = new Error('FileReader failed');
    convertBlobToB64.mockRejectedValue(error);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    WebHelper.postMaterial({ name: 'a.png', type: 'image/png' }, vi.fn(), vi.fn());
    await new Promise((r) => setTimeout(r, 0));

    expect(consoleSpy).toHaveBeenCalledWith(error);
    consoleSpy.mockRestore();
  });
});
