import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  UI_MODES,
  getUiModeOverride,
  setUiModeOverride,
  useUiModeOverride,
  resolveUiMode,
  isSmallTouchScreen,
  getUiMode,
  setActiveUiMode,
  isMobileUi,
} from './uiMode';

const KEY = 'nordvik.uiMode';

function fakeWindow({ coarse, width, height, matchMedia = true }) {
  return {
    screen: { width, height },
    matchMedia: matchMedia
      ? (query) => ({ matches: query === '(pointer: coarse)' ? coarse : false })
      : undefined,
  };
}

describe('uiMode', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    setActiveUiMode('desktop');
    vi.restoreAllMocks();
  });

  it('offers Auto, Desktop and Mobile', () => {
    expect(UI_MODES).toEqual(['auto', 'desktop', 'mobile']);
  });

  it('the override defaults to auto and ignores unknown values', () => {
    expect(getUiModeOverride()).toBe('auto');
    localStorage.setItem(KEY, 'tablet');
    expect(getUiModeOverride()).toBe('auto');
  });

  it('stores a valid override and refuses an invalid one', () => {
    setUiModeOverride('mobile');
    expect(getUiModeOverride()).toBe('mobile');
    setUiModeOverride('tablet');
    expect(getUiModeOverride()).toBe('mobile');
  });

  it('falls back to auto when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(getUiModeOverride()).toBe('auto');
  });

  it('useUiModeOverride follows changes made on this page', () => {
    const { result } = renderHook(() => useUiModeOverride());
    expect(result.current).toBe('auto');
    act(() => setUiModeOverride('desktop'));
    expect(result.current).toBe('desktop');
  });

  it('an explicit override wins over the screen', () => {
    expect(resolveUiMode('mobile', false)).toBe('mobile');
    expect(resolveUiMode('desktop', true)).toBe('desktop');
  });

  it('auto picks mobile only on a small touch screen', () => {
    expect(resolveUiMode('auto', true)).toBe('mobile');
    expect(resolveUiMode('auto', false)).toBe('desktop');
  });

  it('a phone is small in either orientation', () => {
    expect(isSmallTouchScreen(fakeWindow({ coarse: true, width: 390, height: 844 }))).toBe(true);
    expect(isSmallTouchScreen(fakeWindow({ coarse: true, width: 844, height: 390 }))).toBe(true);
  });

  it('a tablet, a mouse or a missing matchMedia is not a small touch screen', () => {
    expect(isSmallTouchScreen(fakeWindow({ coarse: true, width: 820, height: 1180 }))).toBe(false);
    expect(isSmallTouchScreen(fakeWindow({ coarse: false, width: 390, height: 844 }))).toBe(false);
    expect(isSmallTouchScreen(fakeWindow({ coarse: true, width: 390, height: 844, matchMedia: false }))).toBe(false);
  });

  it('getUiMode combines the override with the screen', () => {
    setUiModeOverride('mobile');
    expect(getUiMode()).toBe('mobile');
    setUiModeOverride('auto');
    // jsdom: no matchMedia, so auto is desktop
    expect(getUiMode()).toBe('desktop');
  });

  it('the active mode is what the game picked, desktop until then', () => {
    expect(isMobileUi()).toBe(false);
    setActiveUiMode('mobile');
    expect(isMobileUi()).toBe(true);
  });
});
