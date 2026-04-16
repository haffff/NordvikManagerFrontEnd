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
import WebHelper from '../../helpers/WebHelper';

const CENTRAL_URL = process.env.REACT_APP_CENTRAL_URL || '';
const FALLBACK_STUN = process.env.REACT_APP_STUN_SERVER || 'stun:stun.l.google.com:19302';

// Recursively lower-cases the first character of every object key.
// Mirrors the same helper in WebRTCWebHelper — applied here so push messages
// (dispatched via _dispatchToSubscribers) arrive with camelCase keys, matching
// what Subscribable/CollectionSyncer expect.
function _camelizeKeys(obj) {
  if (Array.isArray(obj)) return obj.map(_camelizeKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k.charAt(0).toLowerCase() + k.slice(1),
        _camelizeKeys(v),
      ])
    );
  }
  return obj;
}

// WebRTC data channels have a browser-imposed max message size (~256 KB in Chrome).
// Anything larger (e.g. base64 file uploads) must be split into chunks.
const SEND_CHUNK_SIZE = 15_000; // bytes — safely under all major browser limits

class WebRTCManager {
  // Mirrors WebSocketManager properties used by Game.js / hooks
  WebSocketStarted = false;
  WebSocketReady = false;
  IsGM = false;

  _sessionId = null;
  _role = 'player';
  _onErrorCallback = null;
  _authRetried = false;
  _signaling = null;
  _pc = null;            // RTCPeerConnection
  _dataChannel = null;   // RTCDataChannel
  _gmPeerId = null;

  _onMessageEvents = [];
  _messageQueue = [];        // queued Send() calls
  _pendingCandidates = [];   // ICE candidates buffered before remoteDescription is set
  _chunkBuffer = new Map(); // chunkId → { parts, received, total } for incoming chunks
  _pendingAuth = false;  // prevents concurrent re-authentication loops
  _iceServers = null;    // populated from /meta before peer connection starts

  // ── Observability fields ──────────────────────────────────────────────────
  _traceId = null;          // short 8-char UUID prefix generated at Start(), shared with Central Server
  _connectStartTime = null; // Date.now() at Start(), used to report total connection time
  _iceSentCount = 0;        // ICE candidates sent to GM backend
  _iceReceivedCount = 0;    // ICE candidates received from GM backend

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async Start(sessionId, onError, role = 'player') {
    if (this.WebSocketStarted) return;

    this._traceId = crypto.randomUUID().slice(0, 8);
    this._connectStartTime = Date.now();

    this._log('log', `Starting — session=${sessionId} role=${role}`);
    this._sessionId = sessionId;
    this._role = role;
    this._onErrorCallback = onError;
    this._authRetried = false;
    this.WebSocketStarted = true;  // Set immediately so Game.js proceeds

    // Ensure we have a fresh access token for signaling
    try {
      await this._ensureAccessToken();
    } catch (e) {
      this._log('error', 'Failed to obtain access token', e);
      this._handleError(e);
      return;
    }

    // Fetch ICE server config from the GM backend /meta endpoint
    try {
      const meta = await WebHelper.getAsync('meta');
      const iceServers = [];
      if (meta?.stunServers?.length) {
        iceServers.push({ urls: meta.stunServers });
      }
      if (meta?.turnServer) {
        iceServers.push(meta.turnServer);
      }
      this._iceServers = iceServers.length ? iceServers : [{ urls: FALLBACK_STUN }];
      this._log('log', `ICE servers loaded: ${JSON.stringify(this._iceServers)}`);
    } catch (e) {
      this._log('warn', 'Failed to fetch ICE config from /meta, using fallback STUN', e);
      this._iceServers = [{ urls: FALLBACK_STUN }];
    }

    // Inject this manager into WebRTCWebHelper
    WebRTCWebHelperInstance.setTransport(this);

    this._signaling = new SignalingClient();

    this._signaling.on('connect', () => {
      this._log('log', 'Signaling connected, authenticating');
      this._signaling.authenticate({
        token: TokenStore.getAccessToken(),
        sessionId,
        role: this._role ?? 'player',
        traceId: this._traceId,
      });
    });

    this._signaling.on('connect_error', (err) => {
      this._log('error', 'Signaling connection error', err);
      this._handleError(err);
    });

    this._signaling.on(SIGNAL_EVENTS.AUTH_ERROR, async ({ error }) => {
      this._log('error', `Signaling auth error: ${error}`);

      // Token expired — try a silent refresh and re-authenticate once
      if (!this._authRetried) {
        this._authRetried = true;
        this._log('log', 'Attempting token refresh after auth error...');
        try {
          TokenStore.setAccessToken(null); // force _ensureAccessToken to refresh
          await this._ensureAccessToken();
          this._log('log', 'Token refreshed, re-authenticating');
          this._signaling.authenticate({
            token: TokenStore.getAccessToken(),
            sessionId: this._sessionId,
            role: this._role ?? 'player',
            traceId: this._traceId,
          });
          return;
        } catch (e) {
          this._log('error', 'Token refresh failed', e);
        }
      }

      const authErr = new Error(error);
      authErr.isAuthError = true;
      this._handleError(authErr);
    });

    this._signaling.on(SIGNAL_EVENTS.SESSION_INFO, ({ gmPeerId }) => {
      this._pendingAuth = false;
      if (!gmPeerId) {
        this._log('warn', 'GM backend not yet connected to session, retrying in 3s');
        // Set _pendingAuth immediately so PEER_JOINED events arriving during the 3s wait
        // do not trigger a concurrent re-authentication. The flag stays true until the
        // next SESSION_INFO response clears it.
        this._pendingAuth = true;
        setTimeout(async () => {
          if (!this.WebSocketStarted || !this._signaling) return;
          if (this._gmPeerId) return;
          this._authRetried = false; // allow one token refresh per retry attempt
          try {
            await this._ensureAccessToken();
          } catch (e) {
            this._pendingAuth = false;
            this._log('error', 'Token refresh failed during session retry', e);
            this._handleError(e);
            return;
          }
          this._signaling.authenticate({
            token: TokenStore.getAccessToken(),
            sessionId,
            role: this._role,
            traceId: this._traceId,
          });
          // _pendingAuth stays true — the next SESSION_INFO response will clear it
        }, 3000);
        return;
      }
      if (this._gmPeerId) return; // already connecting
      this._log('log', `GM peer id: ${gmPeerId}`);
      this._gmPeerId = gmPeerId;
      this._startPeerConnection();
    });

    this._signaling.on(SIGNAL_EVENTS.PEER_JOINED, () => {
      // peer-joined fires for both players and the GM backend (Central Server broadcasts it for
      // both roles on first connect). If we're still waiting for the GM peer id, re-authenticate
      // to get fresh session-info. Guard: skip if already have the GM peer id or a re-auth is in-flight.
      if (!this._gmPeerId && !this._pendingAuth) {
        this._log('log', 'Peer joined, re-authenticating to get GM peer id');
        this._pendingAuth = true;
        this._signaling.authenticate({
          token: TokenStore.getAccessToken(),
          sessionId,
          role: this._role,
          traceId: this._traceId,
        });
      }
    });

    this._signaling.on(SIGNAL_EVENTS.WEBRTC_ANSWER, ({ answer }) => {
      if (!this._pc) return;
      this._log('log', 'Received answer from GM backend');
      this._pc.setRemoteDescription(new RTCSessionDescription(answer))
        .then(() => {
          this._log('log', `Remote description set — flushing ${this._pendingCandidates.length} buffered ICE candidate(s)`);
          // Flush any ICE candidates that arrived before the remote description was set
          for (const c of this._pendingCandidates) this._applyIceCandidate(c);
          this._pendingCandidates = [];
        })
        .catch((e) => this._log('error', 'setRemoteDescription error', e));
    });

    this._signaling.on(SIGNAL_EVENTS.ICE_CANDIDATE, ({ candidate }) => {
      if (!this._pc || !candidate) return;
      // Buffer candidates that arrive before the remote description is set — they are flushed
      // immediately after setRemoteDescription resolves in the WEBRTC_ANSWER handler above.
      if (!this._pc.remoteDescription) {
        this._pendingCandidates.push(candidate);
        this._log('log', `ICE candidate buffered (remoteDescription not yet set), total buffered: ${this._pendingCandidates.length}`);
        return;
      }
      this._iceReceivedCount++;
      this._log('log', `ICE candidate received from GM backend (#${this._iceReceivedCount})`);
      this._applyIceCandidate(candidate);
    });

    this._signaling.on(SIGNAL_EVENTS.PEER_LEFT, ({ peerId }) => {
      if (peerId === this._gmPeerId) {
        this._log('warn', `GM backend disconnected (peerId=${peerId})`);
        this.WebSocketReady = false;
      }
    });

    this._signaling.connect(CENTRAL_URL);
  }

  Close() {
    this._log('log', 'Closing');
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
    this._pendingCandidates = [];
    this._chunkBuffer.clear();
    this._sessionId = null;
    this._role = 'player';
    this._authRetried = false;
    this._pendingAuth = false;
    this._iceServers = null;
    this._traceId = null;
    this._connectStartTime = null;
    this._iceSentCount = 0;
    this._iceReceivedCount = 0;
  }

  // ── Send / Subscribe (same interface as WebSocketManager) ────────────────

  Send(command) {
    if (!command) return false;

    if (this.isChannelReady()) {
      try {
        this._dataChannel.send(JSON.stringify(command));
        return true;
      } catch (e) {
        this._log('error', 'Send error', e);
        this._messageQueue.push(command);
        return false;
      }
    }
    this._messageQueue.push(command);
    return false;
  }

  // Send a raw object (used by WebRTCWebHelper for api-requests).
  // Large messages are automatically split into chunks to stay under the
  // browser's RTCDataChannel send limit (~256 KB in Chrome).
  sendRaw(message) {
    if (!this.isChannelReady()) {
      this._log('warn', `sendRaw called before channel ready, readyState=${this._dataChannel?.readyState}`);
      return false;
    }
    const json = JSON.stringify(message);
    this._log('log', `sendRaw: ${message.method} ${message.path} (${json.length}b)`);

    if (json.length <= SEND_CHUNK_SIZE) {
      this._dataChannel.send(json);
      return true;
    }

    // Split into fixed-size string chunks
    const chunkId = crypto.randomUUID();
    const total = Math.ceil(json.length / SEND_CHUNK_SIZE);
    this._log('log', `sendRaw: splitting into ${total} chunks (chunkId=${chunkId})`);
    for (let i = 0; i < total; i++) {
      const envelope = JSON.stringify({
        type: 'chunk',
        chunkId,
        index: i,
        total,
        data: json.slice(i * SEND_CHUNK_SIZE, (i + 1) * SEND_CHUNK_SIZE),
      });
      this._dataChannel.send(envelope);
    }
    return true;
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

  // Prefixes every log message with [WebRTC|<traceId>] so all messages for a
  // single connection attempt can be grepped as a correlated unit.
  _log(level, msg, ...args) {
    const prefix = `[WebRTC|${this._traceId ?? '?'}]`;
    // eslint-disable-next-line no-console
    console[level](prefix, msg, ...args);
  }

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
    this._log('log', `Creating RTCPeerConnection with ${this._iceServers?.length ?? 0} ICE server(s)`);
    const pc = new RTCPeerConnection({
      iceServers: this._iceServers ?? [{ urls: FALLBACK_STUN }],
    });
    this._pc = pc;

    // Player creates the data channel; GM backend listens via ondatachannel
    const dc = pc.createDataChannel('game');
    this._dataChannel = dc;

    dc.onopen = () => {
      const elapsed = Date.now() - (this._connectStartTime ?? Date.now());
      this._log('log', `Data channel open — ${elapsed}ms from Start() | iceSent=${this._iceSentCount} iceReceived=${this._iceReceivedCount}`);
      this.WebSocketReady = true;
      this._processMessageQueue();
      WebRTCWebHelperInstance.flushQueue();
      // Notify all subscribers so status components update
      this._dispatchToSubscribers({ command: '__channel_ready__' });
    };

    dc.onclose = () => {
      this._log('warn', 'Data channel closed');
      this.WebSocketReady = false;
    };

    dc.onerror = (e) => {
      this._log('error', 'Data channel error', e);
    };

    dc.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Reassemble chunked messages
        if (data?.type === 'chunk') {
          const { chunkId, index, total, data: slice } = data;
          if (!this._chunkBuffer.has(chunkId)) {
            this._chunkBuffer.set(chunkId, { parts: new Array(total), received: 0, total });
          }
          const entry = this._chunkBuffer.get(chunkId);
          entry.parts[index] = slice;
          entry.received++;
          if (entry.received < entry.total) return; // wait for remaining chunks
          this._chunkBuffer.delete(chunkId);
          const assembled = JSON.parse(entry.parts.join(''));
          if (assembled?.type === 'api-response') {
            WebRTCWebHelperInstance.handleApiResponse(assembled);
          } else {
            this._dispatchToSubscribers(_camelizeKeys(assembled));
          }
          return;
        }

        // Route api-responses to WebRTCWebHelper; everything else to subscribers
        if (data?.type === 'api-response') {
          WebRTCWebHelperInstance.handleApiResponse(data);
        } else {
          this._dispatchToSubscribers(_camelizeKeys(data));
        }
      } catch (e) {
        this._log('error', 'Failed to parse data channel message', e);
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && this._gmPeerId) {
        this._iceSentCount++;
        this._log('log', `ICE candidate sent to GM backend (#${this._iceSentCount})`);
        this._signaling.sendIceCandidate({ targetPeerId: this._gmPeerId, candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      this._log('log', `RTCPeerConnection state: ${pc.connectionState}`);
      if (pc.connectionState === 'failed') this._handleError(new Error('WebRTC connection failed'));
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this._signaling.sendOffer({ targetPeerId: this._gmPeerId, offer: pc.localDescription });
      this._log('log', `Offer sent to GM backend (gmPeerId=${this._gmPeerId})`);
    } catch (e) {
      this._log('error', 'Failed to create/send offer', e);
      this._handleError(e);
    }
  }

  // Normalises a raw ICE candidate object and adds it to the peer connection.
  // SIPSorcery omits the 'candidate:' prefix and can send null sdpMid — both are fixed here.
  _applyIceCandidate(candidate) {
    const candidateStr = candidate.candidate ?? '';
    const normalizedInit = {
      ...candidate,
      candidate: candidateStr.startsWith('candidate:') ? candidateStr : `candidate:${candidateStr}`,
      sdpMid: candidate.sdpMid ?? String(candidate.sdpMLineIndex ?? 0),
    };
    this._pc.addIceCandidate(new RTCIceCandidate(normalizedInit))
      .catch((e) => this._log('error', 'addIceCandidate error', e));
  }

  _processMessageQueue() {
    const count = this._messageQueue.length;
    if (count > 0) this._log('log', `Flushing ${count} queued message(s)`);
    while (this._messageQueue.length > 0) {
      const msg = this._messageQueue.shift();
      try { this._dataChannel.send(JSON.stringify(msg)); } catch (e) { this._log('error', 'Failed to flush queued message', e); }
    }
  }

  _dispatchToSubscribers(data) {
    this._onMessageEvents.forEach(({ name, method }) => {
      try { method(data); } catch (e) { this._log('error', `Subscriber ${name} error`, e); }
    });
  }

  _handleError(err) {
    if (this._onErrorCallback) this._onErrorCallback(err);
  }
}

const WebRTCManagerInstance = new WebRTCManager();
export default WebRTCManagerInstance;
