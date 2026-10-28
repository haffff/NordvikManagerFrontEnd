import { useState, useEffect, useCallback } from 'react';
import { ActiveTransportManager as WebSocketManagerInstance } from '../../../helpers/transport';
import useUUID from './useUUID';

/**
 * Custom hook for monitoring WebSocket connection status
 * @returns {Object} Connection status and helper methods
 */
export const useWebSocketConnection = () => {
    const [connectionState, setConnectionState] = useState('DISCONNECTED');
    const [queuedMessages, setQueuedMessages] = useState(0);
    const [isReady, setIsReady] = useState(false);
    const uuid = useUUID();

    const updateStatus = useCallback(() => {
        const state = WebSocketManagerInstance.getConnectionState();
        const queued = WebSocketManagerInstance.getQueuedMessageCount();
        const ready = WebSocketManagerInstance.isConnected();
        
        setConnectionState(state);
        setQueuedMessages(queued);
        setIsReady(ready);
    }, []);

    useEffect(() => {
        // Initial status update
        updateStatus();

        // Subscribe to WebSocket events to update status. Keyed per-instance (like
        // useClientMediator) — a hardcoded name here would let a second mount of this
        // hook silently overwrite the first's callback, and either one unmounting
        // would delete the shared entry out from under the other.
        const statusSubscription = `useWebSocketConnection_status-${uuid}`;

        WebSocketManagerInstance.Subscribe(statusSubscription, () => {
            updateStatus();
        });

        // Periodic status updates (fallback in case events are missed)
        const interval = setInterval(updateStatus, 5000);

        return () => {
            WebSocketManagerInstance.Unsubscribe(statusSubscription);
            clearInterval(interval);
        };
    }, [updateStatus, uuid]);

    const forceReconnect = useCallback(() => {
        WebSocketManagerInstance.forceReconnect();
    }, []);

    return {
        connectionState,
        queuedMessages,
        isReady,
        isConnecting: connectionState === 'CONNECTING',
        isDisconnected: connectionState === 'DISCONNECTED' || connectionState === 'CLOSED',
        forceReconnect,
        updateStatus
    };
};

export default useWebSocketConnection;
