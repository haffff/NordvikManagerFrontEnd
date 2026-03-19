import React from 'react';
import { Flex, Text, Badge, IconButton } from '@chakra-ui/react';
import { FaWifi, FaExclamationTriangle, FaSpinner, FaPlug, FaRedo } from 'react-icons/fa';
import { Tooltip } from '../ui/tooltip';
import { useWebSocketConnection } from './hooks/useWebSocketConnection';

/**
 * WebSocket connection status indicator component with icons
 */
export const WebSocketStatus = ({ showDetails = false, onReconnect, compact = false }) => {
    const { 
        connectionState, 
        queuedMessages, 
        isDisconnected, 
        forceReconnect 
    } = useWebSocketConnection();

    const getStatusColor = () => {
        switch (connectionState) {
            case 'READY': return 'green';
            case 'CONNECTING':
            case 'AUTHENTICATING': return 'yellow';
            case 'CLOSING':
            case 'DISCONNECTED':
            case 'CLOSED': return 'red';
            default: return 'gray';
        }
    };

    const getStatusText = () => {
        switch (connectionState) {
            case 'READY': return compact ? 'Online' : 'Connected';
            case 'CONNECTING': return 'Connecting...';
            case 'AUTHENTICATING': return 'Auth...';
            case 'CLOSING': return 'Closing...';
            case 'DISCONNECTED': return compact ? 'Offline' : 'Disconnected';
            case 'CLOSED': return 'Closed';
            default: return 'Unknown';
        }
    };

    const getStatusIcon = () => {
        const iconProps = { size: compact ? 12 : 14 };
        switch (connectionState) {
            case 'READY': return <FaWifi {...iconProps} />;
            case 'CONNECTING':
            case 'AUTHENTICATING': return <FaSpinner {...iconProps} className="fa-spin" />;
            case 'CLOSING':
            case 'DISCONNECTED':
            case 'CLOSED': return <FaExclamationTriangle {...iconProps} />;
            default: return <FaPlug {...iconProps} />;
        }
    };

    const handleReconnect = () => {
        if (onReconnect) {
            onReconnect();
        } else {
            forceReconnect();
        }
    };    return (
        <Flex align="center" gap={compact ? 2 : 3}>
            <Tooltip 
                content={isDisconnected ? "Click to reconnect" : `WebSocket ${connectionState.toLowerCase()}`}
            >
                <Flex 
                    align="center" 
                    gap={1} 
                    cursor={isDisconnected ? "pointer" : "default"}
                    onClick={isDisconnected ? handleReconnect : undefined}
                    _hover={isDisconnected ? { opacity: 0.8 } : {}}
                    transition="opacity 0.2s"
                >
                    {getStatusIcon()}
                    <Badge 
                        colorScheme={getStatusColor()} 
                        variant="solid"
                        size={compact ? "sm" : "md"}
                    >
                        {getStatusText()}
                    </Badge>
                </Flex>
            </Tooltip>
            
            {showDetails && queuedMessages > 0 && (
                <Tooltip content={`${queuedMessages} messages waiting to be sent`}>
                    <Text fontSize="xs" color="orange.400" fontWeight="medium">
                        {queuedMessages} queued
                    </Text>
                </Tooltip>
            )}
            
            {showDetails && isDisconnected && (
                <Tooltip content="Force reconnect WebSocket">
                    <IconButton
                        size="sm"
                        variant="ghost"
                        colorScheme="blue"
                        onClick={handleReconnect}
                        aria-label="Reconnect WebSocket"
                        _hover={{ bg: "blue.50" }}
                    >
                        <FaRedo size={12} />
                    </IconButton>
                </Tooltip>
            )}
        </Flex>
    );
};

export default WebSocketStatus;
