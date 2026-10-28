import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import * as Dockable from '@hlorenzi/react-dockable';
import { useStableDockState } from './useStableDockState';

// useDockable() returns a new { ref, updateToken, commit } object on every render,
// so everything depending on it (the Game API registration, CreateLayoutElement, ...)
// re-ran on every dock commit — every click in the app. The stable view keeps the
// same identity while still reaching the same state and committing to it.
describe('useStableDockState', () => {
  it('keeps one identity across dock commits, and still commits', () => {
    const seen = [];
    const { result } = renderHook(() => {
      const state = Dockable.useDockable();
      const stable = useStableDockState(state);
      seen.push(stable);
      return { state, stable };
    });
    const first = result.current;

    act(() => first.stable.commit());

    expect(result.current.state.updateToken).toBe(first.state.updateToken + 1);
    expect(result.current.state).not.toBe(first.state); // what used to change every render
    expect(new Set(seen).size).toBe(1);
    expect(result.current.stable.ref).toBe(first.state.ref);
  });
});
