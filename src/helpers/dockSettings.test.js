import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DEFAULT_DOCK_MODIFIER, getDockModifier, setDockModifier, useDockModifier } from './dockSettings';

const KEY = 'nordvik.dockModifier';

describe('dockSettings', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to Shift', () => {
    expect(getDockModifier()).toBe('Shift');
    expect(DEFAULT_DOCK_MODIFIER).toBe('Shift');
  });

  it('ignores an unknown stored value', () => {
    localStorage.setItem(KEY, 'Meta');
    expect(getDockModifier()).toBe('Shift');
  });

  it('stores a valid modifier and refuses an invalid one', () => {
    setDockModifier('Alt');
    expect(getDockModifier()).toBe('Alt');

    setDockModifier('Meta');
    expect(getDockModifier()).toBe('Alt');
  });

  it('useDockModifier follows changes made on this page', () => {
    const { result } = renderHook(() => useDockModifier());
    expect(result.current).toBe('Shift');

    act(() => setDockModifier('None'));

    expect(result.current).toBe('None');
  });

  it('useDockModifier follows changes made in another tab', () => {
    const { result } = renderHook(() => useDockModifier());

    act(() => {
      localStorage.setItem(KEY, 'Ctrl');
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });

    expect(result.current).toBe('Ctrl');
  });
});
