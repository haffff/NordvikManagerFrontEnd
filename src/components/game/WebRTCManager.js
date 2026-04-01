// WebRTC transport manager.
// Mirrors the public API of WebSocketManager so Game.js and its hooks work
// without changes when running in player mode.
//
// Connection flow:
//   Start(sessionId) → Socket.IO signaling → RTCPeerConnection + data channel
//   → offer → answer (from GM backend via central server) → ICE → channel open
//   → WebSocketReady = true → flushes message queue + REST request queue

import SignalingClient, { SIGNAL_EVENTS } from '../../helpers/SignalingClient';
import WebRTCWebHelperInstance from '../../helpers/WebRTCWebHelper';
import TokenStore from '../../helpers/TokenStore';
import CentralWebHelper from '../../helpers/CentralWebHelper';

const CENTRAL_URL = process.env.REACT_APP_CENTRAL_URL || '';
const STUN_SERVER = process.env.REACT_APP_STUN_SERVER || 'stun:stun.l.google.com:19302';

class WebRTCManager {
  // Mirrors WebSocketManager properties used by Game.js / hooks
  WebSocketStarted = false;
  WebSocketReady = false;
  IsGM = false;

  _sessionId = null;
  _onErrorCallback = null;
  _signaling = null;
  _pc = null;            // RTCPeerConnection
  _dataChannel = null;   // RTCDataChannel
  _gmPeerId = null;

  _onMessageEvents = [];
  _messageQueue = [];    // queued Send() calls

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async Start(sessionId, onError) {
    if (this.WebSocketStarted) return;

    console.log('[WebRTCManager] Starting for session', sessionId);
    this._sessionId = sessionId;
    this._onErrorCallback = onError;
    this.WebSocketStarted = true;  // Set immediately so Game.js proceeds

    // Ensure we have a fresh access token for signaling
    try {
      await this._ensureAccessToken();
    } catch (e) {
      console.error('[WebRTCManager] Failed to obtain access token', e);
      this._handleError(e);
      return;
    }

    // Inject this manager into WebRTCWebHelper
    WebRTCWebHelperInstance.setTransport(this);

    this._signaling = new SignalingClient();

    this._signaling.on('connect', () => {
      console.log('[WebRTCManager] Signaling connected, authenticating');
      this._signaling.authenticate({
        token: TokenStore.getAccessToken(),
        sessionId,
        role: 'player',
      });
    });

    this._signaling.on('connect_error', (err) => {
      console.error('[WebRTCManager] Signaling connection error', err);
      this._handleError(err);
    });

    this._signaling.on(SIGNAL_EVENTS.AUTH_ERROR, ({ error }) => {
      console.error('[WebRTCManager] Signaling auth error:', error);
      this._handleError(new Error(error));
    });

    this._signaling.on(SIGNAL_EVENTS.SESSION_INFO, ({ gmPeerId }) => {
      if (!gmPeerId) {
        console.warn('[WebRTCManager] GM backend not yet connected to session, retrying in 3s');
        setTimeout(() => {
          if (!this.WebSocketStarted || !this._signaling) return;
          this._signaling.authenticate({
            token: TokenStore.getAccessToken(),
            sessionId,
            role: 'player',
          });
        }, 3000);
        return;
      }
      if (this._gmPeerId) return; // already connecting
      console.log('[WebRTCManager] GM peer id:', gmPeerId);
      this._gmPeerId = gmPeerId;
      this._startPeerConnection();
    });

    this._signaling.on(SIGNAL_EVENTS.PEER_JOINED, () => {
      // GM backend came online while we were waiting — request fresh session-info immediately
      if (!this._gmPeerId) {
        console.log('[WebRTCManager] Peer joined, re-authenticating to get GM peer id');
        this._signaling.authenticate({
          token: TokenStore.getAccessToken(),
          sessionId,
          role: 'player',
        });
      }
    });

    this._signaling.on(SIGNAL_EVENTS.WEBRTC_ANSWER, ({ answer }) => {
      if (!this._pc) return;
      console.log('[WebRTCManager] Received answer from GM backend');
      this._pc.setRemoteDescription(new RTCSessionDescription(answer))
        .catch((e) => console.error('[WebRTCManager] setRemoteDescription error', e));
    });

    this._signaling.on(SIGNAL_EVENTS.ICE_CANDIDATE, ({ candidate }) => {
      if (!this._pc || !candidate) return;
      // Ignore candidates that arrive before the remote description — normal race condition during negotiation
      if (!this._pc.remoteDescription) return;
      // SIPSorcery sends candidate bodies without the required 'candidate:' prefix; normalise here
      const candidateStr = candidate.candidate ?? '';
      const normalizedInit = {
        ...candidate,
        candidate: candidateStr.startsWith('candidate:') ? candidateStr : `candidate:${candidateStr}`,
        // sdpMid can be null from SIPSorcery — fall back to sdpMLineIndex as a string
        sdpMid: candidate.sdpMid ?? String(candidate.sdpMLineIndex ?? 0),
      };
      this._pc.addIceCandidate(new RTCIceCandidate(normalizedInit))
        .catch((e) => console.error('[WebRTCManager] addIceCandidate error', e));
    });

    this._signaling.on(SIGNAL_EVENTS.PEER_LEFT, ({ peerId }) => {
      if (peerId === this._gmPeerId) {
        console.warn('[WebRTCManager] GM backend disconnected');
        this.WebSocketReady = false;
      }
    });

    this._signaling.connect(CENTRAL_URL);
  }

  Close() {
    console.log('[WebRTCManager] Closing');
    this._dataChannel?.close();
    this._pc?.close();
    this._signaling?.disconnect();

    this._dataChannel = null;
    this._pc = null;
    this._signaling = null;
    this._gmPeerId = null;
    this.WebSocketStarted = false;
    this.WebSocketReady = false;
    this._messageQueue = [];
    this._sessionId = null;
  }

  // ── Send / Subscribe (same interface as WebSocketManager) ────────────────

  Send(command) {
    if (!command) return false;

    if (this.isChannelReady()) {
      try {
        this._dataChannel.send(JSON.stringify(command));
        return true;
      } catch (e) {
        console.error('[WebRTCManager] Send error', e);
        this._messageQueue.push(command);
        return false;
      }
    }
    this._messageQueue.push(command);
    return false;
  }

  // Send a raw object (used by WebRTCWebHelper for api-requests)
  sendRaw(message) {
    if (this.isChannelReady()) {
      const json = JSON.stringify(message);
      console.log(`[WebRTCManager] sendRaw: ${message.method} ${message.path} (${json.length}b)`);
      this._dataChannel.send(json);
      return true;
    }
    // WebRTCWebHelper manages its own request queue; this path shouldn't hit
    console.warn('[WebRTCManager] sendRaw called before channel ready, readyState=', this._dataChannel?.readyState);
    return false;
  }

  Subscribe(name, method) {
    const idx = this._onMessageEvents.findIndex((x) => x.name === name);
    if (idx >= 0) { this._onMessageEvents[idx].method = method; return; }
    this._onMessageEvents.push({ name, method });
  }

  Unsubscribe(name) {
    this._onMessageEvents = this._onMessageEvents.filter((x) => x.name !== name);
  }

  ClearSubscription() {
    this._onMessageEvents = [];
  }

  // ── Status helpers (mirrors WebSocketManager) ────────────────────────────

  isConnected() { return this.WebSocketReady; }
  isChannelReady() { return this._dataChannel?.readyState === 'open'; }

  getConnectionState() {
    if (!this.WebSocketStarted) return 'DISCONNECTED';
    if (this.WebSocketReady) return 'READY';
    return 'CONNECTING';
  }

  getQueuedMessageCount() { return this._messageQueue.length; }
  getSubscriberCount() { return this._onMessageEvents.length; }

  forceReconnect() {
    const sessionId = this._sessionId;
    const onError = this._onErrorCallback;
    this.Close();
    if (sessionId) this.Start(sessionId, onError);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  async _ensureAccessToken() {
    if (TokenStore.getAccessToken()) return;

    const refreshToken = TokenStore.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token available. Please log in again.');

    const resp = await CentralWebHelper.postAsync('user/refresh', { refreshToken });
    if (!resp || !resp.ok) throw new Error('Token refresh failed. Please log in again.');

    const data = await resp.json();
    TokenStore.setTokens(data.accessToken, data.refreshToken);
  }

  async _startPeerConnection() {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: STUN_SERVER }],
    });
    this._pc = pc;

    // Player creates the data channel; GM backend listens via ondatachannel
    const dc = pc.createDataChannel('game');
    this._dataChannel = dc;

    dc.onopen = () => {
      console.log('[WebRTCManager] Data channel open');
      this.WebSocketReady = true;
      this._processMessageQueue();
      WebRTCWebHelperInstance.flushQueue();
      // Notify all subscribers so status components update
      this._dispatchToSubscribers({ command: '__channel_ready__' });
    };

    dc.onclose = () => {
      console.warn('[WebRTCManager] Data channel closed');
      this.WebSocketReady = false;
    };

    dc.onerror = (e) => {
      console.error('[WebRTCManager] Data channel error', e);
    };

    dc.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Route api-responses to WebRTCWebHelper; everything else to subscribers
        if (data?.type === 'api-response') {
          WebRTCWebHelperInstance.handleApiResponse(data);
        } else {
          this._dispatchToSubscribers(data);
        }
      } catch (e) {
        console.error('[WebRTCManager] Failed to parse data channel message', e);
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && this._gmPeerId) {
        this._signaling.sendIceCandidate({ targetPeerId: this._gmPeerId, candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTCManager] Connection state:', pc.connectionState);
      if (pc.connectionState === 'failed') this._handleError(new Error('WebRTC connection failed'));
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this._signaling.sendOffer({ targetPeerId: this._gmPeerId, offer: pc.localDescription });
      console.log('[WebRTCManager] Offer sent to GM backend');
    } catch (e) {
      console.error('[WebRTCManager] Failed to create/send offer', e);
      this._handleError(e);
    }
  }

  _processMessageQueue() {
    while (this._messageQueue.length > 0) {
      const msg = this._messageQueue.shift();
      try { this._dataChannel.send(JSON.stringify(msg)); } catch (e) { console.error(e); }
    }
  }

  _dispatchToSubscribers(data) {
    this._onMessageEvents.forEach(({ name, method }) => {
      try { method(data); } catch (e) { console.error(`[WebRTCManager] Subscriber ${name} error`, e); }
    });
  }

  _handleError(err) {
    if (this._onErrorCallback) this._onErrorCallback(err);
  }
}

const WebRTCManagerInstance = new WebRTCManager();
export default WebRTCManagerInstance;
