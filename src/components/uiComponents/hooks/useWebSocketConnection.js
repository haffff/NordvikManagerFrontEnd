import { useState, useEffect, useCallback } from 'react';
import { ActiveTransportManager as WebSocketManagerInstance } from '../../../helpers/transport';

/**
 * Custom hook for monitoring WebSocket connection status
 * @returns {Object} Connection status and helper methods
 */
export const useWebSocketConnection = () => {
    const [connectionState, setConnectionState] = useState('DISCONNECTED');
    const [queuedMessages, setQueuedMessages] = useState(0);
    const [isReady, setIsReady] = useState(false);

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

        // Subscribe to WebSocket events to update status
        const statusSubscription = 'useWebSocketConnection_status';
        
        WebSocketManagerInstance.Subscribe(statusSubscription, () => {
            updateStatus();
        });

        // Periodic status updates (fallback in case events are missed)
        const interval = setInterval(updateStatus, 5000);

        return () => {
            WebSocketManagerInstance.Unsubscribe(statusSubscription);
            clearInterval(interval);
        };
    }, [updateStatus]);

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
