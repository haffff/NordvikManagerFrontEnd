import * as React from "react";

/**
 * A view of the dock state with the same identity for the whole session.
 *
 * Dockable.useDockable() returns a new { ref, updateToken, commit } object on every
 * render, and every dock commit (a click in any panel, each mouse move while dragging
 * one) re-renders Game. Anything keyed on that object — the Game API registration,
 * CreateLayoutElement — re-ran on every click. This keeps the same `ref` (the dock
 * state itself) and a `commit` that bumps the same counter (its setter is stable).
 *
 * Only what needs to re-render on every commit should get the live state:
 * Dockable.Container and LayoutAutoSaveManager (it reads updateToken).
 */
export function useStableDockState(state) {
  // state.commit is a new closure each render but always calls the same stable
  // setter, so the first one stays valid; depending on it would defeat the purpose.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useMemo(() => ({ ref: state.ref, commit: state.commit }), [state.ref]);
}

export default useStableDockState;
