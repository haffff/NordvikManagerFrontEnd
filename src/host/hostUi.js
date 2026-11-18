// The host build's shared UI state: what the host button shows (wherever it is: the game's
// toolbar, the lobby's, or floating on screens with neither) and whether the drawer and the
// startup dialog are open.
import { useSyncExternalStore } from 'react';

const INITIAL = {
  persisted: undefined, // the browser's answer to persistent storage (undefined: not known yet)
  sessions: 0, // game sessions this tab runs
  unread: 0, // errors logged since the Logs tab was last open
  drawerOpen: false,
  drawerTab: 'host',
  introOpen: false, // the startup dialog, opened from the drawer
  buttons: 0, // host buttons on screen (none: HostApp shows a floating one)
};

let state = { ...INITIAL };
const listeners = new Set();

export function setHostUi(patch) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  listeners.forEach((fn) => fn());
}

export function resetHostUi() {
  state = { ...INITIAL };
  listeners.forEach((fn) => fn());
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const getHostUi = () => state;

export function useHostUi() {
  return useSyncExternalStore(subscribe, getHostUi, getHostUi);
}
