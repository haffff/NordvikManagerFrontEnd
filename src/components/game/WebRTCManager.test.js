import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// vi.mock factories are hoisted above imports/top-level consts, so anything they
// reference must go through vi.hoisted().
const { signalingHandlers, signalingState } = vi.hoisted(() => ({
  signalingHandlers: new Map(),
  signalingState: { connected: true, authenticate: null, reconnect: null, cycle: null },
}));

// Fake signaling transport — captures handlers registered via .on() so tests can
// fire them directly, without a real Socket.IO connection.
vi.mock('../../helpers/SignalingClient', () => ({
  default: class FakeSignalingClient {
    on(event, handler) { signalingHandlers.set(event, handler); }
    authenticate(payload) { signalingState.authenticate?.(payload); }
    connect() {}
    reconnect() { signalingState.reconnect?.(); }
    cycle() { signalingState.cycle?.(); }
    isConnected() { return signalingState.connected; }
    disconnect() {}
    sendOffer() {}
    sendIceCandidate() {}
  },
  SIGNAL_EVENTS: {
    AUTHENTICATE: 'authenticate',
    PEER_JOINED: 'peer-joined',
    PEER_LEFT: 'peer-left',
    SESSION_INFO: 'session-info',
    WEBRTC_ANSWER: 'webrtc-answer',
    AUTH_ERROR: 'auth-error',
    ICE_CANDIDATE: 'ice-candidate',
    ERROR: 'error',
  },
}));

vi.mock('../../helpers/TokenStore', () => ({
  default: {
    getAccessToken: vi.fn(() => 'fake-access-token'),
    setAccessToken: vi.fn(),
  },
}));

const { centralWebHelperMock, refreshAccessTokenMock } = vi.hoisted(() => ({
  centralWebHelperMock: { postAsync: vi.fn(), getAsync: vi.fn() },
  refreshAccessTokenMock: vi.fn(),
}));
vi.mock('../../helpers/CentralWebHelper', () => ({
  default: centralWebHelperMock,
  refreshAccessToken: refreshAccessTokenMock,
}));

const { webRTCWebHelperMock } = vi.hoisted(() => ({
  webRTCWebHelperMock: {
    setTransport: vi.fn(),
    reset: vi.fn(),
    flushQueue: vi.fn(),
    handleApiResponse: vi.fn(),
  },
}));
vi.mock('../../helpers/WebRTCWebHelper', () => ({
  default: webRTCWebHelperMock,
}));

const { appModeMock, gmRefreshMock } = vi.hoisted(() => ({
  appModeMock: { player: true },
  gmRefreshMock: vi.fn(),
}));
vi.mock('../../helpers/appMode', () => ({ isPlayerMode: () => appModeMock.player }));
vi.mock('../../helpers/gmCentralToken', () => ({ refreshCentralTokenViaBackend: gmRefreshMock }));

const { protocolMock } = vi.hoisted(() => ({
  protocolMock: {
    PROTOCOL_VERSION: 1,
    clientPathForProtocol: (n) => `/client/p${n}/`,
    clientExistsForProtocol: vi.fn(),
    navigateTo: vi.fn(),
    isServedFrom: vi.fn(() => false),
  },
}));
vi.mock('../../helpers/protocol', () => protocolMock);

const { recordMock } = vi.hoisted(() => ({ recordMock: vi.fn() }));
vi.mock('../../helpers/demoRecorder', () => ({ demoRecorder: { record: recordMock } }));

import WebRTCManagerInstance, { iceServersFrom, describeIceServers, camelizeKeys } from './WebRTCManager';
import TokenStore from '../../helpers/TokenStore';

// An unsigned JWT-shaped token expiring `seconds` from now (negative: already expired).
const jwtExpiringIn = (seconds) => {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'HS256' })}.${b64({ sub: 'u', exp: Math.floor(Date.now() / 1000) + seconds })}.sig`;
};

describe('WebRTCManager', () => {
  beforeEach(async () => {
    signalingHandlers.clear();
    vi.clearAllMocks();
    signalingState.connected = true;
    signalingState.authenticate = vi.fn();
    signalingState.reconnect = vi.fn();
    // A new signaling socket: Socket.IO fires 'connect' on it.
    signalingState.cycle = vi.fn(() => signalingHandlers.get('connect')?.());
    appModeMock.player = true;
    WebRTCManagerInstance.Close();
    await WebRTCManagerInstance.Start('session-1', vi.fn());
  });

  afterEach(() => {
    WebRTCManagerInstance.Close();
  });

  // The GM backend's signaling socket leaving (it reconnects on its own) says nothing about
  // the data channel, which runs peer to peer. Closing a healthy channel here, while keeping
  // the old GM peer id, left the player stuck on CONNECTING until a reload.
  describe('PEER_LEFT handling', () => {
    it('keeps an open data channel and forgets the GM peer id, so the GM coming back is noticed', async () => {
      WebRTCManagerInstance._gmPeerId = 'gm-1';
      const fakeDataChannel = { readyState: 'open', close: vi.fn() };
      const fakePc = { close: vi.fn() };
      WebRTCManagerInstance._dataChannel = fakeDataChannel;
      WebRTCManagerInstance._pc = fakePc;
      WebRTCManagerInstance.WebSocketReady = true;

      signalingHandlers.get('peer-left')({ peerId: 'gm-1' });

      expect(fakeDataChannel.close).not.toHaveBeenCalled();
      expect(WebRTCManagerInstance.isChannelReady()).toBe(true);
      expect(WebRTCManagerInstance._gmPeerId).toBeNull();

      // The GM's new signaling connection: re-authenticate to learn its peer id.
      signalingHandlers.get('peer-joined')({ peerId: 'gm-2' });
      await new Promise((r) => setTimeout(r, 0));
      expect(signalingState.authenticate).toHaveBeenCalledTimes(1);
    });

    it('drops a connection still being set up and tries again', () => {
      vi.useFakeTimers();
      WebRTCManagerInstance._gmPeerId = 'gm-1';
      const fakeDataChannel = { readyState: 'connecting', close: vi.fn() };
      const fakePc = { close: vi.fn() };
      WebRTCManagerInstance._dataChannel = fakeDataChannel;
      WebRTCManagerInstance._pc = fakePc;

      signalingHandlers.get('peer-left')({ peerId: 'gm-1' });

      expect(fakeDataChannel.close).toHaveBeenCalledTimes(1);
      expect(fakePc.close).toHaveBeenCalledTimes(1);
      expect(WebRTCManagerInstance._pc).toBeNull();
      expect(WebRTCManagerInstance.isChannelReady()).toBe(false);
      vi.useRealTimers();
    });

    it('ignores PEER_LEFT for a peer that is not the GM', () => {
      WebRTCManagerInstance._gmPeerId = 'gm-1';
      const fakeDataChannel = { readyState: 'open', close: vi.fn() };
      WebRTCManagerInstance._dataChannel = fakeDataChannel;

      signalingHandlers.get('peer-left')({ peerId: 'some-other-player' });

      expect(fakeDataChannel.close).not.toHaveBeenCalled();
      expect(WebRTCManagerInstance._dataChannel).toBe(fakeDataChannel);
    });
  });

  // The GM backend's protocol arrives with session-info. A player client for another
  // protocol must switch to the frozen build for it before opening the peer connection.
  describe('SESSION_INFO protocol check', () => {
    let startPeer;
    beforeEach(() => {
      startPeer = vi.spyOn(WebRTCManagerInstance, '_startPeerConnection').mockImplementation(() => {});
    });
    afterEach(() => {
      startPeer.mockRestore();
    });

    const sessionInfo = (payload) => signalingHandlers.get('session-info')(payload);
    const flush = () => new Promise((r) => setTimeout(r, 0));

    it('connects normally when the GM protocol matches', async () => {
      sessionInfo({ gmPeerId: 'gm-1', gmProtocol: 1 });
      await flush();

      expect(startPeer).toHaveBeenCalledTimes(1);
      expect(protocolMock.navigateTo).not.toHaveBeenCalled();
    });

    // The GM backend only sets up a peer for sockets it saw join. This socket joined while
    // another (or no) GM connection was up, so it gets a new socket before offering.
    it('takes a new signaling socket before offering to a GM that never saw this socket join', async () => {
      sessionInfo({ gmPeerId: null });
      sessionInfo({ gmPeerId: 'gm-1' });
      await flush();

      expect(signalingState.cycle).toHaveBeenCalledTimes(1);
      expect(startPeer).not.toHaveBeenCalled();

      sessionInfo({ gmPeerId: 'gm-1' }); // the new socket's first session-info
      await flush();
      expect(startPeer).toHaveBeenCalledTimes(1);
    });

    it('connects normally when the GM sends no protocol', async () => {
      sessionInfo({ gmPeerId: 'gm-1' });
      await flush();

      expect(startPeer).toHaveBeenCalledTimes(1);
      expect(protocolMock.navigateTo).not.toHaveBeenCalled();
    });

    it('switches to the matching client build instead of connecting when the protocol differs', async () => {
      protocolMock.clientExistsForProtocol.mockResolvedValue(true);

      sessionInfo({ gmPeerId: 'gm-1', gmProtocol: 2 });
      await flush();

      expect(startPeer).not.toHaveBeenCalled();
      expect(protocolMock.clientExistsForProtocol).toHaveBeenCalledWith(2);
      expect(protocolMock.navigateTo).toHaveBeenCalledWith('/client/p2/?game=session-1');
    });

    // A deploy that put the wrong build in /client/p2/ made that page switch to itself,
    // reloading forever. Already there: stop and say the site is broken.
    it('never switches to the folder it is already served from', async () => {
      protocolMock.clientExistsForProtocol.mockResolvedValue(true);
      protocolMock.isServedFrom.mockReturnValue(true);
      const onError = WebRTCManagerInstance._onErrorCallback;

      sessionInfo({ gmPeerId: 'gm-1', gmProtocol: 2 });
      await flush();

      expect(protocolMock.isServedFrom).toHaveBeenCalledWith('/client/p2/');
      expect(protocolMock.navigateTo).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ isVersionMismatch: true }));
      expect(onError.mock.calls.at(-1)[0].message).toMatch(/wrong player client/);
      protocolMock.isServedFrom.mockReturnValue(false);
    });

    it('reports a version mismatch when no client build exists for the GM protocol', async () => {
      protocolMock.clientExistsForProtocol.mockResolvedValue(false);
      const onError = WebRTCManagerInstance._onErrorCallback;

      sessionInfo({ gmPeerId: 'gm-1', gmProtocol: 7 });
      await flush();

      expect(startPeer).not.toHaveBeenCalled();
      expect(protocolMock.navigateTo).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ isVersionMismatch: true }));
      // The game's server is newer than this page: reloading it is what helps.
      expect(onError.mock.calls[0][0].message).toMatch(/reload/i);
      expect(onError.mock.calls[0][0].message).not.toMatch(/Ask the GM/);
    });

    it.each([['../../evil'], [2.5], [-1], [0], ['2']])('never switches for a GM protocol that is not a positive integer (%s)', async (gmProtocol) => {
      protocolMock.clientExistsForProtocol.mockResolvedValue(true);

      sessionInfo({ gmPeerId: 'gm-1', gmProtocol });
      await flush();

      expect(protocolMock.clientExistsForProtocol).not.toHaveBeenCalled();
      expect(protocolMock.navigateTo).not.toHaveBeenCalled();
    });
  });

  // The refresh token is an httpOnly cookie now; the shared CentralWebHelper helper
  // does the refresh (one at a time, across tabs).
  describe('access token', () => {
    it('refreshes through the shared helper when there is no access token', async () => {
      TokenStore.getAccessToken.mockReturnValueOnce(null);
      refreshAccessTokenMock.mockResolvedValue(true);

      await WebRTCManagerInstance._ensureAccessToken();

      expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
      expect(centralWebHelperMock.postAsync).not.toHaveBeenCalled();
    });

    it('asks the user to log in again when the refresh fails', async () => {
      TokenStore.getAccessToken.mockReturnValueOnce(null);
      refreshAccessTokenMock.mockResolvedValue(false);

      await expect(WebRTCManagerInstance._ensureAccessToken()).rejects.toThrow(/log in again/i);
    });

    // The access token lives 15 minutes; a reconnect later in the game must not reuse it.
    it('refreshes a token that has expired, not only a missing one', async () => {
      TokenStore.getAccessToken.mockReturnValueOnce(jwtExpiringIn(-60));
      refreshAccessTokenMock.mockResolvedValue(true);

      await WebRTCManagerInstance._ensureAccessToken();

      expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
    });

    it('in the GM app, refreshes through the GM backend (it has no Central cookie)', async () => {
      appModeMock.player = false;
      TokenStore.getAccessToken.mockReturnValueOnce(jwtExpiringIn(-60));
      gmRefreshMock.mockResolvedValue(true);

      await WebRTCManagerInstance._ensureAccessToken();

      expect(gmRefreshMock).toHaveBeenCalledTimes(1);
      expect(refreshAccessTokenMock).not.toHaveBeenCalled();
    });

    it('a refresh Central could not answer is tried again, not a reason to log in again', async () => {
      vi.useFakeTimers();
      TokenStore.getAccessToken.mockReturnValue(null);
      refreshAccessTokenMock.mockResolvedValueOnce(null).mockResolvedValueOnce(true);

      await signalingHandlers.get('connect')();
      expect(signalingState.authenticate).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(10_000);

      expect(signalingState.authenticate).toHaveBeenCalledTimes(1);
      expect(WebRTCManagerInstance._onErrorCallback).not.toHaveBeenCalled();
      TokenStore.getAccessToken.mockReturnValue('fake-access-token');
      vi.useRealTimers();
    });

    it('keeps a token that is still good', async () => {
      TokenStore.getAccessToken.mockReturnValueOnce(jwtExpiringIn(600));

      await WebRTCManagerInstance._ensureAccessToken();

      expect(refreshAccessTokenMock).not.toHaveBeenCalled();
    });

    it('authenticates with a fresh token whenever the signaling socket (re)connects', async () => {
      TokenStore.getAccessToken.mockReturnValueOnce(jwtExpiringIn(-60));
      refreshAccessTokenMock.mockResolvedValue(true);

      await signalingHandlers.get('connect')();

      expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
      expect(signalingState.authenticate).toHaveBeenCalledTimes(1);
    });

    it('after a refused token, refreshes and authenticates again, reconnecting the socket if it was closed', async () => {
      refreshAccessTokenMock.mockResolvedValue(true);
      TokenStore.getAccessToken.mockReturnValueOnce(null); // the refused token is dropped first
      signalingState.connected = false; // an older Central closes the socket on auth errors

      await signalingHandlers.get('auth-error')({ error: 'Invalid or expired token' });

      expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
      expect(signalingState.reconnect).toHaveBeenCalledTimes(1);
      expect(WebRTCManagerInstance._onErrorCallback).not.toHaveBeenCalled();
    });

    // Only a stale token is worth a refresh: refreshing and reconnecting on any other
    // refusal went round forever.
    it('reports any other refusal without refreshing or reconnecting', async () => {
      signalingState.connected = false;

      await signalingHandlers.get('auth-error')({ error: 'Session is full' });

      expect(refreshAccessTokenMock).not.toHaveBeenCalled();
      expect(signalingState.reconnect).not.toHaveBeenCalled();
      const err = WebRTCManagerInstance._onErrorCallback.mock.calls[0][0];
      expect(err.message).toBe('Session is full');
      expect(err.isAuthError).toBeFalsy();
    });

    it('refreshes a stale token once per connection, then reports it', async () => {
      refreshAccessTokenMock.mockResolvedValue(true);
      TokenStore.getAccessToken.mockReturnValueOnce(null);

      await signalingHandlers.get('auth-error')({ error: 'Invalid or expired token' });
      await signalingHandlers.get('connect')(); // e.g. the socket reconnected meanwhile
      await signalingHandlers.get('auth-error')({ error: 'Invalid or expired token' });

      expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
      expect(WebRTCManagerInstance._onErrorCallback).toHaveBeenCalledWith(expect.objectContaining({ isAuthError: true }));
    });
  });

  // Chunked messages from the data channel: bad indices or totals must not
  // assemble a message early or allocate huge buffers.
  describe('demo recording', () => {
    beforeEach(() => {
      WebRTCManagerInstance._dataChannel = { readyState: 'open', bufferedAmount: 0, send: vi.fn(), close: vi.fn() };
      vi.spyOn(WebRTCManagerInstance, '_dispatchToSubscribers').mockImplementation(() => {});
    });
    afterEach(() => vi.restoreAllMocks());

    it('records commands and api-requests going out', async () => {
      WebRTCManagerInstance.Send({ command: 'element_update', data: { id: 'e1' } });
      await WebRTCManagerInstance.sendRaw({ type: 'api-request', id: 'r1', method: 'GET', path: 'api/x' });
      expect(recordMock).toHaveBeenCalledWith('out', { command: 'element_update', data: { id: 'e1' } });
      expect(recordMock).toHaveBeenCalledWith('out', { type: 'api-request', id: 'r1', method: 'GET', path: 'api/x' });
    });

    it('records answers as they arrive, and broadcasts as subscribers get them', () => {
      WebRTCManagerInstance._handleChannelMessage({ data: JSON.stringify({ type: 'api-response', id: 'r1', status: 200, body: { Id: 1 } }) });
      WebRTCManagerInstance._handleChannelMessage({ data: JSON.stringify({ Command: 'chat_push', Data: 'hi' }) });
      expect(recordMock).toHaveBeenCalledWith('in', { type: 'api-response', id: 'r1', status: 200, body: { Id: 1 } });
      expect(recordMock).toHaveBeenCalledWith('in', { command: 'chat_push', data: 'hi' });
    });
  });

  describe('chunk reassembly', () => {
    let dispatched;
    const chunk = (chunkId, index, total, data) => WebRTCManagerInstance._handleChannelMessage({ data: JSON.stringify({ type: 'chunk', chunkId, index, total, data }) });
    beforeEach(() => {
      dispatched = vi.spyOn(WebRTCManagerInstance, '_dispatchToSubscribers').mockImplementation(() => {});
    });
    afterEach(() => dispatched.mockRestore());

    it('assembles a message once every chunk has arrived', () => {
      chunk('c1', 1, 2, '":1}');
      chunk('c1', 0, 2, '{"a');
      expect(dispatched).toHaveBeenCalledWith({ a: 1 });
    });

    it('does not count a repeated chunk twice', () => {
      chunk('c2', 0, 2, '{"a');
      chunk('c2', 0, 2, '{"a');
      expect(dispatched).not.toHaveBeenCalled();
      chunk('c2', 1, 2, '":2}');
      expect(dispatched).toHaveBeenCalledWith({ a: 2 });
    });

    it('ignores chunks with an index outside the message', () => {
      chunk('c3', 0, 2, '{"a');
      chunk('c3', 5, 2, 'x');
      chunk('c3', -1, 2, 'x');
      expect(dispatched).not.toHaveBeenCalled();
      expect(WebRTCManagerInstance._chunkBuffer.get('c3').received).toBe(1);
    });

    it('ignores a chunk claiming an absurd total', () => {
      chunk('c4', 0, 1e9, 'x');
      chunk('c5', 0, 'many', 'x');
      expect(WebRTCManagerInstance._chunkBuffer.has('c4')).toBe(false);
      expect(WebRTCManagerInstance._chunkBuffer.has('c5')).toBe(false);
    });
  });

  // Regression: a request still sitting in WebRTCWebHelper's queue/pending at
  // session-end used to survive into the next game's data channel. Close() now
  // drains it via reset().
  it('Close() drains WebRTCWebHelper via reset()', () => {
    WebRTCManagerInstance.Close();
    expect(webRTCWebHelperMock.reset).toHaveBeenCalled();
  });

  // Regression: sendRaw used to push every chunk of a large message into the
  // data channel at once. A few big uploads overflowed Chrome's send queue
  // ("RTCDataChannel send queue is full") and the uploads failed.
  describe('sendRaw pacing', () => {
    const MB = 1024 * 1024;

    // A data channel whose buffer only drains when the test says so.
    const fakeChannel = () => {
      const dc = {
        readyState: 'open',
        bufferedAmount: 0,
        bufferedAmountLowThreshold: 0,
        sent: [],
        send(data) { this.sent.push(data); this.bufferedAmount += data.length; },
        close: vi.fn(),
        drain() { this.bufferedAmount = 0; this.onbufferedamountlow?.(); },
      };
      WebRTCManagerInstance._dataChannel = dc;
      return dc;
    };

    const bigMessage = (bytes) => ({ type: 'api-request', id: 'r1', method: 'POST', path: 'api/x', body: { data: 'x'.repeat(bytes) } });

    it('sends a small message straight away', async () => {
      const dc = fakeChannel();

      await WebRTCManagerInstance.sendRaw({ type: 'api-request', id: 's', body: 'tiny' });

      expect(dc.sent).toHaveLength(1);
    });

    it('stops at about 1 MB buffered and continues as the buffer drains, reporting progress', async () => {
      const dc = fakeChannel();
      const progress = [];
      let done = false;

      const sending = WebRTCManagerInstance.sendRaw(bigMessage(5 * MB), { onProgress: (sent, total) => progress.push([sent, total]) })
        .then(() => { done = true; });

      expect(dc.bufferedAmount).toBeLessThanOrEqual(1.1 * MB);
      expect(done).toBe(false);
      const firstBatch = dc.sent.length;

      for (let i = 0; i < 20 && !done; i++) { dc.drain(); await Promise.resolve(); }
      await sending;

      expect(dc.sent.length).toBeGreaterThan(firstBatch);
      const total = progress[0][1];
      expect(total).toBeGreaterThan(5 * MB);
      expect(progress.at(-1)).toEqual([total, total]);
      expect(progress.map(([sent]) => sent)).toEqual([...progress.map(([sent]) => sent)].sort((a, b) => a - b));
      // Everything arrived, in order, as one chunked message.
      const chunks = dc.sent.map((x) => JSON.parse(x));
      expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
      expect(chunks[0].total).toBe(chunks.length);
    });

    it('a second large message waits for the first instead of overfilling the buffer', async () => {
      const dc = fakeChannel();

      const first = WebRTCManagerInstance.sendRaw(bigMessage(3 * MB));
      const second = WebRTCManagerInstance.sendRaw({ ...bigMessage(3 * MB), id: 'r2' });

      expect(dc.bufferedAmount).toBeLessThanOrEqual(1.1 * MB);
      for (let i = 0; i < 20; i++) { dc.drain(); await Promise.resolve(); }
      await Promise.all([first, second]);
    });

    it('game messages still go out while an upload is waiting', () => {
      const dc = fakeChannel();
      // Left waiting; afterEach's Close() then fails it, which is expected here.
      WebRTCManagerInstance.sendRaw(bigMessage(5 * MB)).catch(() => {});
      const before = dc.sent.length;

      WebRTCManagerInstance.Send({ command: 'element_move' });

      expect(dc.sent.length).toBe(before + 1);
    });

    it('fails a waiting upload when the channel closes', async () => {
      const dc = fakeChannel();
      const sending = WebRTCManagerInstance.sendRaw(bigMessage(5 * MB));

      dc.readyState = 'closed';
      dc.drain();

      await expect(sending).rejects.toThrow(/closed/i);
    });

    it('fails a waiting upload on Close()', async () => {
      fakeChannel();
      const sending = WebRTCManagerInstance.sendRaw(bigMessage(5 * MB));

      WebRTCManagerInstance.Close();

      await expect(sending).rejects.toThrow(/closed/i);
    });
  });

  // Chrome can report 'failed' before the GM backend's later candidates arrive (e.g. coturn
  // refuses relaying to its first, private, candidate) and recover once they do.
  describe('connection failure', () => {
    let pc;
    let dc;
    let onError;
    let peers;
    const OriginalPeerConnection = globalThis.RTCPeerConnection;

    beforeEach(async () => {
      vi.useFakeTimers();
      peers = 0;
      globalThis.RTCPeerConnection = class FakePeerConnection {
        constructor() { pc = this; peers++; this.connectionState = 'new'; }
        createDataChannel() {
          dc = { readyState: 'connecting', bufferedAmount: 0, close: vi.fn(), send: vi.fn() };
          return dc;
        }
        async createOffer() { return {}; }
        async setLocalDescription() {}
        close() {}
      };
      onError = vi.fn();
      WebRTCManagerInstance.Close();
      await WebRTCManagerInstance.Start('session-1', onError);
      WebRTCManagerInstance._gmPeerId = 'gm-1';
      await WebRTCManagerInstance._startPeerConnection();
    });

    afterEach(() => {
      vi.useRealTimers();
      globalThis.RTCPeerConnection = OriginalPeerConnection;
    });

    const setState = (state) => { pc.connectionState = state; pc.onconnectionstatechange(); };
    const open = () => { dc.readyState = 'open'; dc.onopen(); };
    const drop = () => { dc.readyState = 'closed'; dc.onclose(); };
    const sessionInfo = (payload) => signalingHandlers.get('session-info')(payload);
    // Lets the reconnect's async token check and authenticate run.
    const afterReconnectDelay = async () => { await vi.runOnlyPendingTimersAsync(); };

    it('reconnects, instead of giving up, when the connection stays failed', async () => {
      setState('failed');
      vi.advanceTimersByTime(5_000);

      expect(onError).not.toHaveBeenCalled();
      expect(WebRTCManagerInstance._pc).toBeNull();
      await afterReconnectDelay();
      expect(signalingState.authenticate).toHaveBeenCalled();
    });

    it('reconnects when an open data channel closes, and starts a new peer connection', async () => {
      open();
      drop();
      expect(WebRTCManagerInstance.getConnectionState()).toBe('CONNECTING');

      await afterReconnectDelay();
      // A new socket: the GM backend hears it join and sets up a peer for it. Re-offering
      // on the old socket went unanswered by a backend that had cleaned it up.
      expect(signalingState.cycle).toHaveBeenCalledTimes(1);
      expect(signalingState.authenticate).toHaveBeenCalledTimes(1);

      sessionInfo({ gmPeerId: 'gm-2' });
      await vi.advanceTimersByTimeAsync(0);
      expect(peers).toBe(2);
      expect(WebRTCManagerInstance._gmPeerId).toBe('gm-2');
    });

    it('tells subscribers when the channel is back after a drop, so they can catch up', async () => {
      const seen = [];
      WebRTCManagerInstance.Subscribe('test', (m) => seen.push(m));
      open();
      expect(seen.at(-1)).toMatchObject({ command: '__channel_ready__', reconnected: false });

      drop();
      await afterReconnectDelay();
      sessionInfo({ gmPeerId: 'gm-1' });
      await vi.advanceTimersByTimeAsync(0);
      open();

      expect(seen.at(-1)).toMatchObject({ command: '__channel_ready__', reconnected: true });
      WebRTCManagerInstance.Unsubscribe('test');
    });

    it('reports the lost connection once reconnecting keeps failing', async () => {
      open();
      drop();
      for (let i = 0; i < 20 && !onError.mock.calls.length; i++) {
        await afterReconnectDelay();
        // The GM is gone: every attempt's peer connection fails too.
        if (WebRTCManagerInstance._pc) { setState('failed'); vi.advanceTimersByTime(5_000); }
        else sessionInfo({ gmPeerId: 'gm-1' });
        await vi.advanceTimersByTimeAsync(0);
      }

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/lost the connection/i) }));
    });

    it('starts over when the GM backend never answers the offer', async () => {
      vi.advanceTimersByTime(20_000);

      expect(WebRTCManagerInstance._pc).toBeNull();
      await afterReconnectDelay();
      expect(signalingState.cycle).toHaveBeenCalled();
    });

    it('keeps an open channel when signaling reconnects and session-info arrives again', async () => {
      open();
      sessionInfo({ gmPeerId: 'gm-2' });
      await vi.advanceTimersByTimeAsync(0);

      expect(peers).toBe(1);
      expect(dc.close).not.toHaveBeenCalled();
      expect(WebRTCManagerInstance._gmPeerId).toBe('gm-2');
    });

    it('does not reconnect after Close()', async () => {
      open();
      drop();
      WebRTCManagerInstance.Close();
      await afterReconnectDelay();

      expect(signalingState.authenticate).not.toHaveBeenCalled();
    });

    describe('heartbeat', () => {
      const heartbeats = () => dc.send.mock.calls
        .map(([json]) => JSON.parse(json))
        .filter((m) => m.type === 'api-request' && m.path === '/heartbeat');
      const answer = (id) => WebRTCManagerInstance._handleChannelMessage({ data: JSON.stringify({ type: 'api-response', id, status: 200 }) });

      it('pings over an open channel', () => {
        open();
        vi.advanceTimersByTime(5_000);
        expect(heartbeats()).toHaveLength(1);
        expect(heartbeats()[0].method).toBe('GET');
      });

      it('keeps the channel while the backend answers, without handing answers to the REST helper', () => {
        open();
        for (let i = 0; i < 10; i++) {
          vi.advanceTimersByTime(5_000);
          const last = heartbeats().at(-1);
          answer(last.id);
        }
        expect(WebRTCManagerInstance.isChannelReady()).toBe(true);
        expect(dc.close).not.toHaveBeenCalled();
        expect(webRTCWebHelperMock.handleApiResponse).not.toHaveBeenCalled();
      });

      it('reconnects when a ping goes unanswered', () => {
        open();
        vi.advanceTimersByTime(5_000);
        answer(heartbeats()[0].id);
        vi.advanceTimersByTime(30_000);

        expect(dc.close).toHaveBeenCalled();
        expect(WebRTCManagerInstance._pc).toBeNull();
      });

      it('never gives up on a backend that has not answered a single ping', () => {
        // A backend that doesn't answer heartbeats at all: nothing to measure by.
        open();
        vi.advanceTimersByTime(120_000);

        expect(dc.close).not.toHaveBeenCalled();
      });

      it('waits while the channel is still busy sending', () => {
        open();
        vi.advanceTimersByTime(5_000);
        answer(heartbeats()[0].id);
        dc.bufferedAmount = 2_000_000; // a large upload ahead of the ping
        vi.advanceTimersByTime(30_000);

        expect(dc.close).not.toHaveBeenCalled();
      });
    });

    it('does not report a failure the connection recovers from', () => {
      setState('failed');
      setState('connecting');
      setState('connected');

      vi.advanceTimersByTime(10_000);

      expect(onError).not.toHaveBeenCalled();
    });

    it('does not report a failure after Close()', () => {
      setState('failed');
      WebRTCManagerInstance.Close();

      vi.advanceTimersByTime(10_000);

      expect(onError).not.toHaveBeenCalled();
    });

    // The status bar's reconnect: the next open is a catch-up one. The Retry button
    // reloads the game itself, so it asks for none.
    it('forceReconnect() makes the next open a catch-up one, unless told not to', async () => {
      const start = vi.spyOn(WebRTCManagerInstance, 'Start').mockResolvedValue();
      WebRTCManagerInstance.forceReconnect();
      expect(WebRTCManagerInstance._resyncOnOpen).toBe(true);
      WebRTCManagerInstance._resyncOnOpen = false;

      WebRTCManagerInstance._sessionId = 'session-1';
      WebRTCManagerInstance.forceReconnect({ resync: false });
      expect(WebRTCManagerInstance._resyncOnOpen).toBe(false);
      start.mockRestore();
    });
  });

  describe('ICE servers', () => {
    const turnConfig = {
      iceServers: [
        { urls: ['stun:stun.example.com:19302'] },
        { urls: ['turn:turn.example.com:3478?transport=udp'], username: '1767226200:user-1', credential: 'top-secret=' },
      ],
      ttl: 86400,
    };

    it('loads them from Central ice-servers and uses them as-is', async () => {
      centralWebHelperMock.getAsync.mockResolvedValueOnce(turnConfig);
      WebRTCManagerInstance.Close();
      await WebRTCManagerInstance.Start('session-1', vi.fn());

      // GM mode has no Central cookie, only the in-memory token handed over by the backend.
      expect(centralWebHelperMock.getAsync).toHaveBeenCalledWith('ice-servers', 'fake-access-token');
      expect(WebRTCManagerInstance._iceServers).toEqual(turnConfig.iceServers);
    });

    it('falls back to STUN when the request fails or returns nothing', () => {
      const fallback = [{ urls: 'stun:fallback:19302' }];
      expect(iceServersFrom(undefined, fallback)).toBe(fallback);
      expect(iceServersFrom({ iceServers: [] }, fallback)).toBe(fallback);
      expect(iceServersFrom({ iceServers: 'nope' }, fallback)).toBe(fallback);
    });

    it('describes them for logging without credentials', () => {
      const text = describeIceServers(turnConfig.iceServers);
      expect(text).toContain('turn:turn.example.com:3478?transport=udp');
      expect(text).not.toContain('top-secret=');
      expect(text).not.toContain('user-1');
    });
  });
});

// Push messages are camelCased, but an addon's ActionArgs are its own data: a menu item's
// { "Dice": "1d6" } must reach its action as Dice, not dice.
describe('camelizeKeys', () => {
  it('camelCases keys but leaves the inside of actionArgs alone', () => {
    expect(camelizeKeys({ Name: 'x', ActionArgs: { Dice: '1d6', Nested: { Keep: 1 } } }))
      .toEqual({ name: 'x', actionArgs: { Dice: '1d6', Nested: { Keep: 1 } } });
  });

  it("leaves an action trace's variables as the action named them", () => {
    expect(camelizeKeys({ StepPath: '1', Variables: { Data: { Id: 1 }, playerName: 'W' } }))
      .toEqual({ stepPath: '1', variables: { Data: { Id: 1 }, playerName: 'W' } });
  });
});
