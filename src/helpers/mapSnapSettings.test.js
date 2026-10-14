import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DEFAULT_SNAP, getSnapSettings, setSnapSetting, shouldSnapNow, useSnapSettings } from './mapSnapSettings';

const KEY = 'nordvik.mapSnap';

describe('mapSnapSettings', () => {
  beforeEach(() => localStorage.clear());

  it('moving snaps unless Alt is held; scaling snaps only while Ctrl is held', () => {
    expect(DEFAULT_SNAP).toEqual({ move: { mode: 'always', key: 'Alt' }, scale: { mode: 'hold', key: 'Ctrl' } });
    expect(getSnapSettings()).toEqual(DEFAULT_SNAP);
  });

  it('stores a valid choice per operation and refuses invalid ones', () => {
    setSnapSetting('scale', { mode: 'always', key: 'Shift' });
    expect(getSnapSettings().scale).toEqual({ mode: 'always', key: 'Shift' });
    expect(getSnapSettings().move).toEqual(DEFAULT_SNAP.move);

    setSnapSetting('scale', { mode: 'sometimes', key: 'Shift' });
    setSnapSetting('scale', { mode: 'hold', key: 'Meta' });
    setSnapSetting('rotate', { mode: 'hold', key: 'Ctrl' });
    expect(getSnapSettings()).toEqual({ ...DEFAULT_SNAP, scale: { mode: 'always', key: 'Shift' } });
  });

  it('falls back to the defaults for a broken stored value', () => {
    localStorage.setItem(KEY, '{not json');
    expect(getSnapSettings()).toEqual(DEFAULT_SNAP);
    localStorage.setItem(KEY, JSON.stringify({ move: { mode: 'never', key: 'Alt' }, scale: { mode: 'x' } }));
    expect(getSnapSettings()).toEqual({ move: { mode: 'never', key: 'Alt' }, scale: DEFAULT_SNAP.scale });
  });

  it('decides from the keys held', () => {
    const none = {};
    expect(shouldSnapNow({ mode: 'always', key: 'Alt' }, none)).toBe(true);
    expect(shouldSnapNow({ mode: 'always', key: 'Alt' }, { altKey: true })).toBe(false);
    expect(shouldSnapNow({ mode: 'hold', key: 'Ctrl' }, none)).toBe(false);
    expect(shouldSnapNow({ mode: 'hold', key: 'Ctrl' }, { ctrlKey: true })).toBe(true);
    expect(shouldSnapNow({ mode: 'hold', key: 'Ctrl' }, { metaKey: true })).toBe(true); // Cmd on a Mac
    expect(shouldSnapNow({ mode: 'hold', key: 'Shift' }, { shiftKey: true })).toBe(true);
    expect(shouldSnapNow({ mode: 'never', key: 'Alt' }, { altKey: true })).toBe(false);
  });

  it('useSnapSettings follows changes made on this page', () => {
    const { result } = renderHook(() => useSnapSettings());
    expect(result.current).toEqual(DEFAULT_SNAP);

    act(() => setSnapSetting('move', { mode: 'never', key: 'Alt' }));
    expect(result.current.move).toEqual({ mode: 'never', key: 'Alt' });
  });
});
