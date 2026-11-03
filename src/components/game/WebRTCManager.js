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
import { debugLog } from '../../helpers/debugLog';
import { demoRecorder } from '../../helpers/demoRecorder';
import CentralWebHelper, { refreshAccessToken } from '../../helpers/CentralWebHelper';
import { expiresWithin } from '../../helpers/jwtExpiry';
import { isPlayerMode } from '../../helpers/appMode';
import { refreshCentralTokenViaBackend } from '../../helpers/gmCentralToken';
import {
  PROTOCOL_VERSION,
  clientPathForProtocol,
  clientExistsForProtocol,
  navigateTo,
  isServedFrom,
} from '../../helpers/protocol';

const CENTRAL_URL = process.env.REACT_APP_CENTRAL_URL || '';
const FALLBACK_STUN = process.env.REACT_APP_STUN_SERVER || 'stun:stun.l.google.com:19302';
// Debug switch: relay-only ICE, to verify the TURN path end to end.
const FORCE_TURN = process.env.REACT_APP_FORCE_TURN === 'true';

// Central's /api/ice-servers already returns an RTCIceServer[] (TURN entries carry
// short-lived credentials), so it is used as-is; anything unusable falls back to STUN.
export function iceServersFrom(result, fallback) {
  const servers = result?.iceServers;
  return Array.isArray(servers) && servers.length ? servers : fallback;
}

// URLs only — never log TURN usernames/credentials.
export function describeIceServers(servers) {
  return servers.flatMap((s) => [].concat(s.urls)).join(', ');
}

// Recursively lower-cases the first character of every object key.
// Mirrors the same helper in WebRTCWebHelper — applied here so push messages
// (dispatched via _dispatchToSubscribers) arrive with camelCase keys, matching
// what Subscribable/CollectionSyncer expect. The inside of actionArgs (the variables a
// menu item or map tool hands its action) and of an action trace's variables is an
// action's own data, kept as written.
const KEEP_INSIDE = new Set(['actionArgs', 'variables']);

export function camelizeKeys(obj) {
  if (Array.isArray(obj)) return obj.map(camelizeKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => {
        const key = k.charAt(0).toLowerCase() + k.slice(1);
        return [key, KEEP_INSIDE.has(key) ? v : camelizeKeys(v)];
      })
    );
  }
  return obj;
}

// WebRTC data channels have a browser-imposed max message size (~256 KB in Chrome).
// Anything larger (e.g. base64 file uploads) must be split into chunks.
const SEND_CHUNK_SIZE = 15_000; // bytes — safely under all major browser limits
// Incoming chunked messages claiming more parts than this are dropped (~300 MB).
const MAX_INCOMING_CHUNKS = 20_000;
// Chunked messages are fed in only while the channel's send buffer is below this,
// and resume once it drains to LOW. Pushing everything at once overflowed Chrome's
// send queue ("RTCDataChannel send queue is full") with a few large uploads.
const BUFFER_HIGH = 1024 * 1024;
const BUFFER_LOW = 256 * 1024;
// How long the peer connection must stay 'failed' before it's given up on (and reconnected).
const FAILED_GRACE_MS = 5000;
// Reconnecting after the connection was lost: the wait before each attempt. Past the
// last one the error (with its Retry button) is shown.
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000, 15000];
// Data channel heartbeat: an api-request the GM backend answers on the spot (an older one
// answers it with a 404, which proves it's alive just as well). A ping unanswered this long,
// while nothing else is waiting to go out, means the channel is dead.
const HEARTBEAT_PATH = '/heartbeat';
const HEARTBEAT_INTERVAL_MS = 5000;
const HEARTBEAT_TIMEOUT_MS = 20000;
// An access token expiring this soon is refreshed before signaling is handed it.
const TOKEN_REFRESH_MARGIN_MS = 30_000;
// A token refresh Central (or the GM backend) couldn't answer is tried again after this.
const AUTH_RETRY_MS = 5000;
// An offer the GM backend hasn't answered (with the channel open) by then is given up on.
const CONNECT_TIMEOUT_MS = 20000;
// Central's reason for a stale token: the one refusal a refresh can fix.
const STALE_TOKEN_ERROR = 'Invalid or expired token';

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
  _outgoing = [];           // large messages waiting to be chunked out, oldest first
  _pendingAuth = false;  // prevents concurrent re-authentication loops
  _iceServers = null;    // populated from /meta before peer connection starts
  _failedTimer = null;   // pending 'WebRTC connection failed' report, cancelled if the connection recovers
  _reconnectTimer = null;    // pending reconnect attempt
  _reconnectAttempts = 0;    // attempts since the channel was last open
  _resyncOnOpen = false;     // the next open follows a drop: pushes may have been missed
  _heartbeatTimer = null;
  _heartbeatPending = null;  // { id, sentAt } of the ping waiting for its answer
  _heartbeatAnswered = false; // this channel's backend answers heartbeats (only then do they time out)
  _connectTimer = null;      // pending "offer never answered"
  _authRetryTimer = null;    // pending retry of a token refresh that couldn't be done
  // The GM peer id in this signaling socket's first session-info (undefined until then).
  // The GM backend sets up a peer only for sockets it saw join, i.e. when this is still the GM.
  _announcedGm = undefined;

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

    // Fetch ICE servers (STUN + TURN with credentials) from the Central Server
    // Bearer token too: in GM mode there is no Central cookie, only the token from the backend.
    const result = await CentralWebHelper.getAsync('ice-servers', TokenStore.getAccessToken());
    this._iceServers = iceServersFrom(result, [{ urls: FALLBACK_STUN }]);
    if (result) this._log('log', `ICE servers loaded: ${describeIceServers(this._iceServers)}`);
    else this._log('warn', 'Failed to fetch ICE servers from Central, using fallback STUN');

    // Inject this manager into WebRTCWebHelper
    WebRTCWebHelperInstance.setTransport(this);

    this._signaling = new SignalingClient();

    // Also fires when Socket.IO reconnects the socket by itself (Central gives it a new
    // peer id, which needs authenticating), possibly long after the token was fetched.
    this._signaling.on('connect', () => {
      this._log('log', 'Signaling connected, authenticating');
      this._announcedGm = undefined; // a new socket: the GM hears it join now
      return this._authenticateFresh();
    });

    this._signaling.on('connect_error', (err) => {
      this._log('error', 'Signaling connection error', err);
      this._handleError(err);
    });

    this._signaling.on(SIGNAL_EVENTS.AUTH_ERROR, async ({ error }) => {
      this._log('error', `Signaling auth error: ${error}`);

      // Any other refusal (e.g. "Session is full") a refresh can't fix: report it.
      if (error !== STALE_TOKEN_ERROR) {
        this._pendingAuth = false;
        this._handleError(new Error(error));
        return;
      }

      // Token expired: refresh it and authenticate again, once until session-info confirms.
      // (An older Central closed the socket along with the error: it is reconnected then.)
      if (!this._authRetried) {
        this._authRetried = true;
        this._log('log', 'Attempting token refresh after auth error...');
        TokenStore.setAccessToken(null); // force _ensureAccessToken to refresh
        await this._authenticateFresh();
        return;
      }

      this._handleError(this._authError(error));
    });

    this._signaling.on(SIGNAL_EVENTS.SESSION_INFO, ({ gmPeerId, gmProtocol }) => {
      this._pendingAuth = false;
      this._authRetried = false;
      if (this._announcedGm === undefined) this._announcedGm = gmPeerId ?? null;
      if (!gmPeerId) {
        // Still connected to the GM peer to peer: its signaling is just away for now, and
        // peer-joined says when it's back.
        if (this.isChannelReady()) return;
        this._log('warn', 'GM backend not yet connected to session, retrying in 3s');
        // Set _pendingAuth immediately so PEER_JOINED events arriving during the 3s wait
        // do not trigger a concurrent re-authentication. The flag stays true until the
        // next SESSION_INFO response clears it.
        this._pendingAuth = true;
        setTimeout(() => {
          if (!this.WebSocketStarted || !this._signaling) return;
          if (this._gmPeerId) return;
          this._authenticateFresh();
          // _pendingAuth stays true — the next SESSION_INFO response will clear it
        }, 3000);
        return;
      }
      if (this._pc) {
        // Connected (signaling re-authenticated after its socket came back) or connecting:
        // keep the connection, and note the GM's current peer id if it's up.
        if (this.isChannelReady()) this._gmPeerId = gmPeerId;
        return;
      }
      if (gmPeerId !== this._announcedGm) {
        // This socket joined while another (or no) GM connection was up, so this GM backend
        // may have no peer for it and would drop the offer. A new socket is announced to it.
        this._log('log', 'GM backend never saw this signaling socket join, taking a new one');
        this._pendingAuth = true;
        this._signaling.cycle();
        return;
      }
      this._log('log', `GM peer id: ${gmPeerId}`);
      this._gmPeerId = gmPeerId;
      // The loop guard is our own protocol constant: the build we switch to has
      // PROTOCOL_VERSION === gmProtocol, so it connects instead of switching again.
      // Only a positive integer can name a build (it goes into the /client/p<N>/ path).
      const protocol = Number.isInteger(gmProtocol) && gmProtocol > 0 ? gmProtocol : null;
      if (gmProtocol != null && protocol == null) this._log('warn', `Ignoring invalid GM protocol: ${JSON.stringify(gmProtocol)}`);
      if (protocol != null && protocol !== PROTOCOL_VERSION) {
        this._switchToProtocolClient(protocol);
        return;
      }
      this._startPeerConnection();
    });

    this._signaling.on(SIGNAL_EVENTS.PEER_JOINED, () => {
      // peer-joined fires for both players and the GM backend (Central Server broadcasts it for
      // both roles on first connect). If we're still waiting for the GM peer id, re-authenticate
      // to get fresh session-info. Guard: skip if already have the GM peer id or a re-auth is in-flight.
      if (!this._gmPeerId && !this._pendingAuth) {
        this._log('log', 'Peer joined, re-authenticating to get GM peer id');
        this._pendingAuth = true;
        this._authenticateFresh();
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

    // The GM backend's signaling socket left. It reconnects by itself, and the data channel
    // runs peer to peer, so an open channel stays (the heartbeat notices if the backend is
    // really gone). Forgetting its peer id lets peer-joined pick up the new one.
    this._signaling.on(SIGNAL_EVENTS.PEER_LEFT, ({ peerId }) => {
      if (peerId !== this._gmPeerId) return;
      this._log('warn', `GM backend left signaling (peerId=${peerId})`);
      this._gmPeerId = null;
      // A connection still being set up needs signaling to finish: start over.
      if (!this.isChannelReady()) this._scheduleReconnect('GM backend left while connecting');
    });

    this._signaling.connect(CENTRAL_URL);
  }

  Close() {
    this._log('log', 'Closing');
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;
    clearTimeout(this._authRetryTimer);
    this._authRetryTimer = null;
    this._announcedGm = undefined;
    this._teardownPeer();
    this._signaling?.disconnect();
    // Drain any request still queued/in-flight on the REST-over-WebRTC helper —
    // otherwise it would survive into the next game session (see reset()'s comment).
    WebRTCWebHelperInstance.reset();

    this._dataChannel = null;
    this._pc = null;
    this._signaling = null;
    this._gmPeerId = null;
    this.WebSocketStarted = false;
    this.WebSocketReady = false;
    this._messageQueue = [];
    this._pendingCandidates = [];
    this._chunkBuffer.clear();
    this._failOutgoing();
    this._sessionId = null;
    this._role = 'player';
    this._authRetried = false;
    this._pendingAuth = false;
    this._iceServers = null;
    this._traceId = null;
    this._connectStartTime = null;
    this._iceSentCount = 0;
    this._iceReceivedCount = 0;
    this._reconnectAttempts = 0;
    this._resyncOnOpen = false;
  }

  // ── Send / Subscribe (same interface as WebSocketManager) ────────────────

  Send(command) {
    if (!command) return false;
    demoRecorder.record('out', command);

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
  // Large messages are split into chunks to stay under the browser's
  // RTCDataChannel message size limit, and fed in as the send buffer drains.
  // Resolves once the whole message is handed to the channel; rejects if the
  // channel closes first. onProgress(sentBytes, totalBytes) follows the chunks.
  // Small messages (and Send()) go out straight away, also while an upload waits.
  sendRaw(message, { onProgress } = {}) {
    if (!this.isChannelReady()) {
      this._log('warn', `sendRaw called before channel ready, readyState=${this._dataChannel?.readyState}`);
      return Promise.reject(new Error('Data channel closed'));
    }
    demoRecorder.record('out', message);
    const json = JSON.stringify(message);
    this._log('log', `sendRaw: ${message.method} ${message.path} (${json.length}b)`);

    if (json.length <= SEND_CHUNK_SIZE) {
      try {
        this._dataChannel.send(json);
      } catch (e) {
        return Promise.reject(e);
      }
      onProgress?.(json.length, json.length);
      return Promise.resolve();
    }

    const chunkId = crypto.randomUUID();
    const total = Math.ceil(json.length / SEND_CHUNK_SIZE);
    this._log('log', `sendRaw: splitting into ${total} chunks (chunkId=${chunkId})`);
    return new Promise((resolve, reject) => {
      this._outgoing.push({ json, chunkId, total, next: 0, onProgress, resolve, reject });
      this._pumpOutgoing();
    });
  }

  _pumpOutgoing() {
    const dc = this._dataChannel;
    if (!this.isChannelReady()) {
      this._failOutgoing();
      return;
    }
    while (this._outgoing.length > 0 && dc.bufferedAmount < BUFFER_HIGH) {
      const job = this._outgoing[0];
      const envelope = JSON.stringify({
        type: 'chunk',
        chunkId: job.chunkId,
        index: job.next,
        total: job.total,
        data: job.json.slice(job.next * SEND_CHUNK_SIZE, (job.next + 1) * SEND_CHUNK_SIZE),
      });
      try {
        dc.send(envelope);
      } catch (e) {
        this._outgoing.shift();
        job.reject(e);
        continue;
      }
      job.next += 1;
      job.onProgress?.(Math.min(job.next * SEND_CHUNK_SIZE, job.json.length), job.json.length);
      if (job.next === job.total) {
        this._outgoing.shift();
        job.resolve();
      }
    }
    if (this._outgoing.length > 0) {
      // Wait for the buffer to drain, then carry on.
      dc.bufferedAmountLowThreshold = BUFFER_LOW;
      dc.onbufferedamountlow = () => this._pumpOutgoing();
    }
  }

  _failOutgoing() {
    const jobs = this._outgoing.splice(0);
    for (const job of jobs) job.reject(new Error('Data channel closed'));
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

  // resync: whether the next open counts as a catch-up one (__channel_ready__ with
  // reconnected: true). The game's Retry button reloads the game itself, so it passes false.
  forceReconnect({ resync = true } = {}) {
    const sessionId = this._sessionId;
    const onError = this._onErrorCallback;
    const role = this._role;
    this.Close();
    this._resyncOnOpen = resync;
    if (sessionId) this.Start(sessionId, onError, role);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  // Prefixes every log message with [WebRTC|<traceId>] so all messages for a
  // single connection attempt can be grepped as a correlated unit.
  _log(level, msg, ...args) {
    const prefix = `[WebRTC|${this._traceId ?? '?'}]`;
    // Connection tracing only in dev builds or with localStorage.nm_debug set.
    if (level === 'log') {
      debugLog(prefix, msg, ...args);
      return;
    }
    // eslint-disable-next-line no-console
    console[level](prefix, msg, ...args);
  }

  async _ensureAccessToken() {
    const token = TokenStore.getAccessToken();
    // The access token lives 15 minutes: one fetched at the start is long stale by the
    // time a reconnect hands it to signaling.
    if (token && !expiresWithin(token, TOKEN_REFRESH_MARGIN_MS)) return;
    // The player's refresh token is an httpOnly Central cookie (the shared helper refreshes
    // one at a time); the GM app has none and asks its GM backend.
    const refreshed = isPlayerMode() ? await refreshAccessToken() : await refreshCentralTokenViaBackend();
    if (refreshed) return;
    // false: the refresh token was refused. null: couldn't ask right now, try again later.
    if (refreshed === false) throw this._authError('Token refresh failed. Please log in again.');
    throw new Error('Could not refresh the access token right now.');
  }

  async _startPeerConnection() {
    this._log('log', `Creating RTCPeerConnection with ${this._iceServers?.length ?? 0} ICE server(s)`);
    const pc = new RTCPeerConnection({
      iceServers: this._iceServers ?? [{ urls: FALLBACK_STUN }],
      ...(FORCE_TURN && { iceTransportPolicy: 'relay' }),
    });
    this._pc = pc;

    // Player creates the data channel; GM backend listens via ondatachannel
    const dc = pc.createDataChannel('game');
    this._dataChannel = dc;

    dc.onopen = () => {
      const elapsed = Date.now() - (this._connectStartTime ?? Date.now());
      this._log('log', `Data channel open — ${elapsed}ms from Start() | iceSent=${this._iceSentCount} iceReceived=${this._iceReceivedCount}`);
      clearTimeout(this._connectTimer);
      const reconnected = this._resyncOnOpen;
      this._resyncOnOpen = false;
      this._reconnectAttempts = 0;
      this.WebSocketReady = true;
      this._processMessageQueue();
      WebRTCWebHelperInstance.flushQueue();
      this._startHeartbeat();
      // Notify all subscribers so status components update. reconnected: this open follows
      // a lost connection, so pushes sent in between never arrived.
      this._dispatchToSubscribers({ command: '__channel_ready__', reconnected });
    };

    dc.onclose = () => {
      if (this._dataChannel !== dc) return; // replaced, or closed on purpose
      this._log('warn', 'Data channel closed');
      this._scheduleReconnect('data channel closed');
    };

    dc.onerror = (e) => {
      this._log('error', 'Data channel error', e);
    };

    dc.onmessage = (event) => this._handleChannelMessage(event);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && this._gmPeerId) {
        this._iceSentCount++;
        this._log('log', `ICE candidate sent to GM backend (#${this._iceSentCount})`);
        this._signaling.sendIceCandidate({ targetPeerId: this._gmPeerId, candidate });
      } else if (!candidate) {
        this._log('log', `ICE gathering complete — sent=${this._iceSentCount} received=${this._iceReceivedCount}`);
      }
    };

    pc.onicegatheringstatechange = () => {
      this._log('log', `ICE gathering state: ${pc.iceGatheringState}`);
    };

    pc.oniceconnectionstatechange = () => {
      this._log('log', `ICE connection state: ${pc.iceConnectionState}`);
    };

    pc.onconnectionstatechange = () => {
      this._log('log', `RTCPeerConnection state: ${pc.connectionState}`);
      clearTimeout(this._failedTimer);
      // Chrome can report 'failed' before the GM backend's later candidates arrive (e.g. TURN
      // refuses relaying to its first, private, candidate) and recover once they do.
      if (pc.connectionState === 'failed') {
        this._failedTimer = setTimeout(() => {
          if (this._pc === pc && pc.connectionState === 'failed') this._scheduleReconnect('WebRTC connection failed');
        }, FAILED_GRACE_MS);
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this._signaling.sendOffer({ targetPeerId: this._gmPeerId, offer: pc.localDescription });
      this._log('log', `Offer sent to GM backend (gmPeerId=${this._gmPeerId})`);
      // A dropped offer leaves the connection at 'new' for good, with nothing to retry it.
      clearTimeout(this._connectTimer);
      this._connectTimer = setTimeout(() => {
        if (this._pc === pc && !this.isChannelReady()) this._scheduleReconnect('the GM backend never answered');
      }, CONNECT_TIMEOUT_MS);
    } catch (e) {
      this._log('error', 'Failed to create/send offer', e);
      this._handleError(e);
    }
  }

  // Normalises a raw ICE candidate object and adds it to the peer connection.
  // SIPSorcery omits the 'candidate:' prefix and can send null sdpMid — both are fixed here.
  // One data channel message: a whole message, or one chunk of a large one.
  _handleChannelMessage(event) {
    try {
      const data = JSON.parse(event.data);

      // Reassemble chunked messages
      if (data?.type === 'chunk') {
        const { chunkId, index, total, data: slice } = data;
        if (!Number.isInteger(total) || total < 1 || total > MAX_INCOMING_CHUNKS) {
          this._log('warn', `Dropping chunk with invalid total ${JSON.stringify(total)}`);
          return;
        }
        if (!this._chunkBuffer.has(chunkId)) {
          // If a chunk is ever lost, this entry would otherwise sit in the map
          // forever — drop it after a generous timeout so it can't accumulate.
          const staleTimeout = setTimeout(() => {
            if (this._chunkBuffer.has(chunkId)) {
              this._log('warn', `Dropping incomplete chunked message ${chunkId} (timed out)`);
              this._chunkBuffer.delete(chunkId);
            }
          }, 60_000);
          this._chunkBuffer.set(chunkId, { parts: new Array(total), received: 0, total, staleTimeout });
        }
        const entry = this._chunkBuffer.get(chunkId);
        // Only a new slot inside this message counts — a repeat or a stray index
        // must not complete it early.
        if (!Number.isInteger(index) || index < 0 || index >= entry.total || entry.parts[index] !== undefined) return;
        entry.parts[index] = slice;
        entry.received++;
        if (entry.received < entry.total) return; // wait for remaining chunks
        clearTimeout(entry.staleTimeout);
        this._chunkBuffer.delete(chunkId);
        this._routeIncoming(JSON.parse(entry.parts.join('')));
        return;
      }

      this._routeIncoming(data);
    } catch (e) {
      this._log('error', 'Failed to parse data channel message', e);
    }
  }

  // Route api-responses to WebRTCWebHelper; everything else to subscribers.
  _routeIncoming(data) {
    if (data?.type === 'api-response' && typeof data.id === 'string' && data.id.startsWith('hb-')) {
      if (this._heartbeatPending?.id === data.id) this._heartbeatPending = null;
      this._heartbeatAnswered = true;
      return;
    }
    if (data?.type === 'api-response') {
      demoRecorder.record('in', data);
      WebRTCWebHelperInstance.handleApiResponse(data);
    } else {
      const message = camelizeKeys(data);
      demoRecorder.record('in', message);
      this._dispatchToSubscribers(message);
    }
  }

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

  // The GM backend speaks another protocol than this build. Reload into the frozen
  // player build for it (same origin, so login cookies carry over; Central's join
  // lets existing members back in without the game password).
  async _switchToProtocolClient(gmProtocol) {
    const sessionId = this._sessionId;
    this._log('warn', `GM backend uses protocol ${gmProtocol}, this client ${PROTOCOL_VERSION} — switching client`);
    const target = clientPathForProtocol(gmProtocol);
    // Already there, yet this build speaks another protocol: the site holds the wrong build
    // in that folder. Switching again would reload this same page forever.
    if (isServedFrom(target)) {
      const err = new Error(
        `This site has the wrong player client at ${target} (protocol ${PROTOCOL_VERSION}, the game's server needs ${gmProtocol}). ` +
        "Tell whoever runs this site; reloading won't help until it's redeployed."
      );
      err.isVersionMismatch = true;
      this._handleError(err);
      return;
    }
    if (await clientExistsForProtocol(gmProtocol)) {
      this.Close();
      navigateTo(`${target}?game=${encodeURIComponent(sessionId)}`);
      return;
    }
    // Which side is behind decides what helps: a page older than the game's server is
    // fixed by reloading it (a newer site may be out); an older server only by updating it.
    const err = new Error(gmProtocol > PROTOCOL_VERSION
      ? `This page is older than the game's server (protocol ${gmProtocol}, page ${PROTOCOL_VERSION}). ` +
        'Reload the page (Ctrl+F5). If this stays, the site has no player client for this server yet.'
      : `This game's server (protocol ${gmProtocol}) is older than this site supports (protocol ${PROTOCOL_VERSION}). ` +
        'Ask the GM to update their NordvikManager server.'
    );
    err.isVersionMismatch = true;
    this._handleError(err);
  }

  _handleError(err) {
    if (this._onErrorCallback) this._onErrorCallback(err);
  }

  // Makes sure the token is fresh, then authenticates. A refresh that couldn't be done right
  // now is tried again shortly; a refused one is reported (back to the login).
  async _authenticateFresh() {
    clearTimeout(this._authRetryTimer);
    this._authRetryTimer = null;
    try {
      await this._ensureAccessToken();
    } catch (e) {
      if (e.isAuthError) {
        this._log('error', 'Token refresh refused', e);
        this._pendingAuth = false;
        this._handleError(e);
        return;
      }
      this._log('warn', 'Token refresh not possible right now, trying again shortly', e);
      if (this.WebSocketStarted) this._authRetryTimer = setTimeout(() => this._authenticateFresh(), AUTH_RETRY_MS);
      return;
    }
    if (!this.WebSocketStarted) return;
    this._authenticate();
  }

  _authError(message) {
    const err = new Error(message);
    err.isAuthError = true;
    return err;
  }

  // Authenticates on the signaling socket with the current token; a socket that is closed
  // (e.g. an older Central closed it after an auth error) is reconnected instead, and its
  // 'connect' handler authenticates.
  _authenticate() {
    if (!this._signaling) return;
    if (!this._signaling.isConnected()) {
      this._signaling.reconnect();
      return;
    }
    this._signaling.authenticate({
      token: TokenStore.getAccessToken(),
      sessionId: this._sessionId,
      role: this._role ?? 'player',
      traceId: this._traceId,
    });
  }

  // ── Reconnecting ──────────────────────────────────────────────────────────

  // Drops the peer connection and channel (not signaling). Their handlers go first, so
  // closing them here doesn't report a loss of its own.
  _teardownPeer() {
    clearTimeout(this._failedTimer);
    clearTimeout(this._connectTimer);
    this._stopHeartbeat();
    const dc = this._dataChannel;
    const pc = this._pc;
    this._dataChannel = null;
    this._pc = null;
    if (dc) {
      dc.onopen = dc.onclose = dc.onerror = dc.onmessage = dc.onbufferedamountlow = null;
      try { dc.close(); } catch { /* already closed */ }
    }
    if (pc) {
      pc.onicecandidate = pc.onconnectionstatechange = pc.oniceconnectionstatechange = pc.onicegatheringstatechange = null;
      try { pc.close(); } catch { /* already closed */ }
    }
    this._gmPeerId = null;
    this.WebSocketReady = false;
    this._pendingCandidates = [];
    this._failOutgoing();
  }

  // The connection is lost: tear it down and, after a wait, take a new signaling socket
  // (the GM backend hears it join and sets up a peer for it; session-info then starts a new
  // peer connection). Requests made meanwhile queue until the channel is back. After the
  // last attempt the error is shown instead.
  _scheduleReconnect(reason) {
    if (!this.WebSocketStarted || this._reconnectTimer) return;
    this._log('warn', `Connection lost (${reason}), reconnecting`);
    this._teardownPeer();
    this._resyncOnOpen = true;
    if (this._reconnectAttempts >= RECONNECT_DELAYS_MS.length) {
      this._reconnectAttempts = 0;
      this._handleError(new Error('Lost the connection to the game. Retry, or reload the page.'));
      return;
    }
    const delay = RECONNECT_DELAYS_MS[this._reconnectAttempts++];
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._requestSessionInfo();
    }, delay);
  }

  // Its 'connect' handler authenticates (with a fresh token) on the new socket.
  _requestSessionInfo() {
    if (!this.WebSocketStarted || !this._signaling) return;
    this._pendingAuth = true; // session-info clears it
    this._signaling.cycle();
  }

  // ── Heartbeat ─────────────────────────────────────────────────────────────

  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatAnswered = false;
    this._heartbeatTimer = setInterval(() => this._heartbeatTick(), HEARTBEAT_INTERVAL_MS);
  }

  _stopHeartbeat() {
    clearInterval(this._heartbeatTimer);
    this._heartbeatTimer = null;
    this._heartbeatPending = null;
  }

  // One ping at a time; a new one goes out once the last is answered. A late answer is
  // fine while the channel is still sending (an upload ahead of the ping in the queue).
  _heartbeatTick() {
    const dc = this._dataChannel;
    if (!dc || dc.readyState !== 'open') return;
    const now = Date.now();
    if (this._heartbeatPending) {
      // A backend that never answered one gives nothing to measure by (ICE failure still ends it).
      if (!this._heartbeatAnswered) return;
      const busy = dc.bufferedAmount > 0 || this._outgoing.length > 0;
      if (!busy && now - this._heartbeatPending.sentAt > HEARTBEAT_TIMEOUT_MS) {
        this._scheduleReconnect('heartbeat unanswered');
      }
      return;
    }
    const id = `hb-${crypto.randomUUID()}`;
    this._heartbeatPending = { id, sentAt: now };
    try {
      dc.send(JSON.stringify({ type: 'api-request', id, method: 'GET', path: HEARTBEAT_PATH }));
    } catch {
      /* the channel is closing; its close handler takes it from here */
    }
  }
}

const WebRTCManagerInstance = new WebRTCManager();
export default WebRTCManagerInstance;
