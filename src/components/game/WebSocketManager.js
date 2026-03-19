import WebHelper from '../../helpers/WebHelper';

class WebSocketManager {
    WebSocketReady = false;
    WebSocketStarted = false;
    WebSocket = undefined;
    IsGM = false;

    _onMessageEvents = [];
    _messageQueue = [];
    _reconnectAttempts = 0;
    _maxReconnectAttempts = 5;
    _reconnectDelay = 1000; // Start with 1 second
    _reconnectTimer = null;
    _gameId = null;
    _onErrorCallback = null;    Subscribe(name, method) {
        // Check if subscription already exists
        const existingIndex = this._onMessageEvents.findIndex(x => x.name === name);
        if (existingIndex >= 0) {
            // Update existing subscription
            this._onMessageEvents[existingIndex].method = method;
            return;
        }
        this._onMessageEvents.push({ name: name, method: method });
    }    Unsubscribe(name) {
        this._onMessageEvents = this._onMessageEvents.filter(x => x.name !== name);
    }

    ClearSubscription() {
        this._onMessageEvents = [];
    }

    _clearReconnectTimer() {
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
    }

    _processMessageQueue() {
        if (this.WebSocketReady && this._messageQueue.length > 0) {
            console.log(`WebSocket: Processing ${this._messageQueue.length} queued messages`);
            while (this._messageQueue.length > 0) {
                const message = this._messageQueue.shift();
                this.WebSocket.send(JSON.stringify(message));
            }
        }
    }

    Close() {
        console.log("WebSocket: Closing connection");
        this._clearReconnectTimer();
        this.WebSocketReady = false;
        this.WebSocketStarted = false;
        
        if (this.WebSocket) {
            // Remove event listeners to prevent memory leaks
            this.WebSocket.onopen = null;
            this.WebSocket.onclose = null;
            this.WebSocket.onerror = null;
            this.WebSocket.onmessage = null;
            
            if (this.WebSocket.readyState === WebSocket.OPEN || 
                this.WebSocket.readyState === WebSocket.CONNECTING) {
                this.WebSocket.close();
            }
            this.WebSocket = undefined;
        }
        
        // Clear message queue
        this._messageQueue = [];
        this._reconnectAttempts = 0;
    }    Send(command) {
        if (!command) {
            console.warn("WebSocket: Attempted to send empty command");
            return false;
        }

        if (this.WebSocketReady) {
            try {
                this.WebSocket.send(JSON.stringify(command));
                return true;
            } catch (error) {
                console.error("WebSocket: Error sending message:", error);
                // Add to queue for retry
                this._messageQueue.push(command);
                return false;
            }
        } else {
            // Queue message for when connection is ready
            console.log("WebSocket: Queuing message (not ready):", command.command || 'unknown');
            this._messageQueue.push(command);
            return false;
        }
    }    Start(GameID, onError, tryToReconnect = true) {
        console.log("WebSocket: Started connecting with id:", GameID);
        
        this._gameId = GameID;
        this._onErrorCallback = onError;
        this.WebSocketStarted = true;
        
        // If already connected or connecting, don't start again
        if (this.WebSocket && (this.WebSocket.readyState === WebSocket.OPEN || 
                               this.WebSocket.readyState === WebSocket.CONNECTING)) {
            console.log("WebSocket: Already connected or connecting");
            return;
        }

        // Clear any existing reconnect timer
        this._clearReconnectTimer();

        try {
            const ws = new WebSocket(WebHelper.WebSocketAddress);
            this.WebSocket = ws;
            
            ws.onopen = (event) => {
                console.log("WebSocket: Connection opened");
                this._reconnectAttempts = 0; // Reset reconnect attempts on successful connection
                this._reconnectDelay = 1000; // Reset delay
                ws.send(GameID);
            };

            ws.onclose = (event) => {
                console.warn(`WebSocket: Connection closed (code: ${event.code}, reason: ${event.reason})`);
                this.WebSocketReady = false;
                
                if (tryToReconnect && this._reconnectAttempts < this._maxReconnectAttempts) {
                    this._reconnectAttempts++;
                    const delay = this._reconnectDelay * Math.pow(2, this._reconnectAttempts - 1); // Exponential backoff
                    
                    console.log(`WebSocket: Reconnecting in ${delay}ms (attempt ${this._reconnectAttempts}/${this._maxReconnectAttempts})`);
                    
                    this._reconnectTimer = setTimeout(() => {
                        this.WebSocket = undefined; // Clear the old connection
                        this.Start(GameID, onError, tryToReconnect);
                    }, delay);
                } else {
                    console.error("WebSocket: Max reconnection attempts reached or reconnection disabled");
                    this.WebSocketStarted = false;
                }
            };

            ws.onerror = (event) => {
                console.error("WebSocket: Connection error:", event);
                if (this._onErrorCallback) {
                    this._onErrorCallback(event);
                }
            };

            ws.onmessage = (event) => {
                try {
                    if (!this.WebSocketReady) {
                        if (event.data === "OK") {
                            console.log("WebSocket: Connection ready");
                            this.WebSocketReady = true;
                            // Process any queued messages
                            this._processMessageQueue();
                        }
                        return;
                    }
                    
                    const data = JSON.parse(event.data);
                    
                    // Notify all subscribers
                    this._onMessageEvents.forEach(subscriber => {
                        try {
                            subscriber.method(data);
                        } catch (error) {
                            console.error(`WebSocket: Error in subscriber ${subscriber.name}:`, error);
                        }
                    });
                } catch (error) {
                    console.error("WebSocket: Error processing message:", error);
                }
            };
            
        } catch (error) {
            console.error("WebSocket: Error creating connection:", error);
            if (this._onErrorCallback) {
                this._onErrorCallback(error);
            }        }
    }

    // Helper methods for better WebSocket management
    getConnectionState() {
        if (!this.WebSocket) return 'DISCONNECTED';
        
        switch (this.WebSocket.readyState) {
            case WebSocket.CONNECTING: return 'CONNECTING';
            case WebSocket.OPEN: return this.WebSocketReady ? 'READY' : 'AUTHENTICATING';
            case WebSocket.CLOSING: return 'CLOSING';
            case WebSocket.CLOSED: return 'CLOSED';
            default: return 'UNKNOWN';
        }
    }

    isConnected() {
        return this.WebSocketReady && this.WebSocket && this.WebSocket.readyState === WebSocket.OPEN;
    }

    getQueuedMessageCount() {
        return this._messageQueue.length;
    }

    getSubscriberCount() {
        return this._onMessageEvents.length;
    }

    // Force reconnect method
    forceReconnect() {
        if (this._gameId) {
            console.log("WebSocket: Force reconnecting");
            this.Close();
            this.Start(this._gameId, this._onErrorCallback, true);
        }
    }
}

const WebSocketManagerInstance = new WebSocketManager();
export default WebSocketManagerInstance;
