import { useEffect, useRef } from 'react';
import { ActiveTransportManager } from './transport';

// Catching up after a dropped connection. Pushes the GM server sent while the channel was
// down never arrive, so whatever a view loaded from the server is out of date once it's back
// (WebRTCManager announces that as __channel_ready__ with reconnected: true). Each view that
// loads server data registers its load here and runs it again then.

let nextId = 0;

/** Runs `load` every time the channel is back after a drop. Returns an unsubscribe function. */
export function onResync(load) {
  const name = `resync-${++nextId}`;
  ActiveTransportManager.Subscribe(name, (message) => {
    if (message?.command !== '__channel_ready__' || !message.reconnected) return;
    try {
      const result = load();
      result?.catch?.((e) => console.warn('resync: reloading failed', e));
    } catch (e) {
      console.warn('resync: reloading failed', e);
    }
  });
  return () => ActiveTransportManager.Unsubscribe(name);
}

/** onResync for a component: always calls the latest `load`, and stops on unmount. */
export function useResync(load) {
  const latest = useRef(load);
  latest.current = load;
  useEffect(() => onResync(() => latest.current?.()), []);
}

export default useResync;
