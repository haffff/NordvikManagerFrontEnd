import { useEffect, useRef } from 'react';
import { ActiveTransportManager } from '../../../helpers/transport';
import { toaster } from '../../ui/toaster';
import useUUID from '../../uiComponents/hooks/useUUID';

const TOAST_ID = 'nm-reconnected';

/**
 * Once the connection to the game is back after a drop, pushes sent in between never
 * arrived (other players' moves, chat, changes). Panels can't catch up on their own yet,
 * so the player is told and offered a reload, which re-enters the game (?game= stays in
 * the URL). One notice, however often it reconnects.
 *
 * onChannelReady runs on every open, e.g. to clear a connection error shown earlier.
 */
export function useReconnectNotice({ reload = () => window.location.reload(), onChannelReady } = {}) {
  const uuid = useUUID();
  const latest = useRef({ reload, onChannelReady });
  latest.current = { reload, onChannelReady };

  useEffect(() => {
    const name = `useReconnectNotice-${uuid}`;
    ActiveTransportManager.Subscribe(name, (message) => {
      if (message?.command !== '__channel_ready__') return;
      latest.current.onChannelReady?.();
      if (!message.reconnected || toaster.isVisible?.(TOAST_ID)) return;
      toaster.create({
        id: TOAST_ID,
        type: 'warning',
        title: 'Reconnected',
        description: 'The connection to the game dropped for a moment. Changes made meanwhile may be missing.',
        duration: Infinity,
        meta: { closable: true },
        action: { label: 'Reload game', onClick: () => latest.current.reload() },
      });
    });
    return () => ActiveTransportManager.Unsubscribe(name);
  }, [uuid]);
}

export default useReconnectNotice;
