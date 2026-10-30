import { describe, it, expect, vi } from 'vitest';
import { canFullscreen, isFullscreen, toggleFullscreen } from './fullscreen';

const fakeDocument = (props = {}) => ({
  documentElement: {},
  ...props,
});

describe('fullscreen', () => {
  it('is unavailable where the browser allows it only for videos (iPhone Safari)', () => {
    expect(canFullscreen(fakeDocument())).toBe(false);
    expect(canFullscreen(fakeDocument({ fullscreenEnabled: false }))).toBe(false);
  });

  it('is available with the standard API or the webkit one (older iPad Safari)', () => {
    expect(canFullscreen(fakeDocument({ fullscreenEnabled: true }))).toBe(true);
    expect(canFullscreen(fakeDocument({ webkitFullscreenEnabled: true }))).toBe(true);
  });

  it('knows whether something is full screen', () => {
    expect(isFullscreen(fakeDocument())).toBe(false);
    expect(isFullscreen(fakeDocument({ fullscreenElement: {} }))).toBe(true);
    expect(isFullscreen(fakeDocument({ webkitFullscreenElement: {} }))).toBe(true);
  });

  it('enters full screen on the whole page, hiding the browser bars', () => {
    const requestFullscreen = vi.fn(() => Promise.resolve());
    const doc = fakeDocument({ fullscreenEnabled: true, documentElement: { requestFullscreen } });
    toggleFullscreen(doc);
    expect(requestFullscreen).toHaveBeenCalledWith({ navigationUI: 'hide' });
  });

  it('enters through webkit when that is all there is', () => {
    const webkitRequestFullscreen = vi.fn();
    const doc = fakeDocument({ webkitFullscreenEnabled: true, documentElement: { webkitRequestFullscreen } });
    toggleFullscreen(doc);
    expect(webkitRequestFullscreen).toHaveBeenCalled();
  });

  it('leaves full screen when already in it', () => {
    const exitFullscreen = vi.fn(() => Promise.resolve());
    const webkitExitFullscreen = vi.fn();
    toggleFullscreen(fakeDocument({ fullscreenEnabled: true, fullscreenElement: {}, exitFullscreen }));
    expect(exitFullscreen).toHaveBeenCalled();
    toggleFullscreen(fakeDocument({ webkitFullscreenEnabled: true, webkitFullscreenElement: {}, webkitExitFullscreen }));
    expect(webkitExitFullscreen).toHaveBeenCalled();
  });

  it('swallows a refusal (no user gesture, a permissions policy)', async () => {
    const requestFullscreen = vi.fn(() => Promise.reject(new Error('denied')));
    const doc = fakeDocument({ fullscreenEnabled: true, documentElement: { requestFullscreen } });
    await expect(toggleFullscreen(doc)).resolves.toBeUndefined();
  });
});
