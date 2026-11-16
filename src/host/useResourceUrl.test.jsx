import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../helpers/appMode', () => ({ isHostMode: () => true }));

import { useResourceUrl } from './useResourceUrl';

// In the host build an image's URL becomes a blob: URL. When the URL changes, the old blob is
// revoked, so it must not stay shown: nothing until the new one is in (and nothing if that fails).
describe('useResourceUrl in the host build', () => {
  let made = 0;
  beforeEach(() => {
    made = 0;
    URL.createObjectURL = vi.fn(() => `blob:${++made}`);
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    delete URL.createObjectURL;
    delete URL.revokeObjectURL;
    vi.unstubAllGlobals();
  });

  it('drops the old blob URL when the URL changes and the new one fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['a']) })
      .mockResolvedValueOnce({ ok: false });
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(({ url }) => useResourceUrl(url), { initialProps: { url: '/a' } });
    await waitFor(() => expect(result.current).toBe('blob:1'));

    rerender({ url: '/b' });

    expect(result.current).toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(result.current).toBeNull();
  });
});
