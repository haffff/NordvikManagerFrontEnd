import { io } from 'socket.io-client';

// Event name constants matching the central server's events.js
export const SIGNAL_EVENTS = {
  // Client → Server
  AUTHENTICATE: 'authenticate',
  WEBRTC_OFFER: 'webrtc-offer',
  WEBRTC_ANSWER: 'webrtc-answer',
  ICE_CANDIDATE: 'ice-candidate',
  // Server → Client
  AUTHENTICATED: 'authenticated',
  AUTH_ERROR: 'auth-error',
  PEER_JOINED: 'peer-joined',
  PEER_LEFT: 'peer-left',
  SESSION_INFO: 'session-info',
  ERROR: 'error',
};

class SignalingClient {
  _socket = null;
  _pendingHandlers = new Map(); // event → handler, registered before connect()

  connect(url) {
    this._socket = io(url, {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket'],
      autoConnect: true,
    });

    // Attach any handlers registered before connect()
    for (const [event, handler] of this._pendingHandlers) {
      this._socket.on(event, handler);
    }
  }

  on(event, handler) {
    this._pendingHandlers.set(event, handler);
    this._socket?.on(event, handler);
  }

  off(event) {
    this._pendingHandlers.delete(event);
    this._socket?.off(event);
  }

  emit(event, data) {
    this._socket?.emit(event, data);
  }

  authenticate({ token, sessionId, role }) {
    this.emit(SIGNAL_EVENTS.AUTHENTICATE, { token, sessionId, role });
  }

  sendOffer({ targetPeerId, offer }) {
    this.emit(SIGNAL_EVENTS.WEBRTC_OFFER, { targetPeerId, offer });
  }

  sendAnswer({ targetPeerId, answer }) {
    this.emit(SIGNAL_EVENTS.WEBRTC_ANSWER, { targetPeerId, answer });
  }

  sendIceCandidate({ targetPeerId, candidate }) {
    this.emit(SIGNAL_EVENTS.ICE_CANDIDATE, { targetPeerId, candidate });
  }

  disconnect() {
    this._socket?.disconnect();
    this._socket = null;
    this._pendingHandlers.clear();
  }

  isConnected() {
    return this._socket?.connected ?? false;
  }
}

export default SignalingClient;
