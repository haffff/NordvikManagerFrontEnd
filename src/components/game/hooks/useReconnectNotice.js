import { useEffect, useRef } from 'react';
import { ActiveTransportManager } from '../../../helpers/transport';
import { toaster } from '../../ui/toaster';
import useUUID from '../../uiComponents/hooks/useUUID';

const TOAST_ID = 'nm-reconnected';
const TOAST_MS = 4000;

/**
 * Once the connection to the game is back after a drop, the game's views load what changed
 * meanwhile on their own (helpers/resync.js), so the player is only told, briefly. One notice
 * at a time, however often it reconnects.
 *
 * onChannelReady runs on every open, e.g. to clear a connection error shown earlier.
 */
export function useReconnectNotice({ onChannelReady } = {}) {
  const uuid = useUUID();
  const latest = useRef({ onChannelReady });
  latest.current = { onChannelReady };

  useEffect(() => {
    const name = `useReconnectNotice-${uuid}`;
    ActiveTransportManager.Subscribe(name, (message) => {
      if (message?.command !== '__channel_ready__') return;
      latest.current.onChannelReady?.();
      if (!message.reconnected || toaster.isVisible?.(TOAST_ID)) return;
      toaster.create({
        id: TOAST_ID,
        type: 'info',
        title: 'Reconnected',
        description: 'The connection to the game dropped for a moment; the game has caught up.',
        duration: TOAST_MS,
      });
    });
    return () => ActiveTransportManager.Unsubscribe(name);
  }, [uuid]);
}

export default useReconnectNotice;
