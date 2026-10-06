import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// vi.mock factories are hoisted above imports/top-level consts, so anything they
// reference must go through vi.hoisted().
const { signalingHandlers } = vi.hoisted(() => ({ signalingHandlers: new Map() }));

// Fake signaling transport — captures handlers registered via .on() so tests can
// fire them directly, without a real Socket.IO connection.
vi.mock('../../helpers/SignalingClient', () => ({
  default: class FakeSignalingClient {
    on(event, handler) { signalingHandlers.set(event, handler); }
    authenticate() {}
    connect() {}
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
    getRefreshToken: vi.fn(() => 'fake-refresh-token'),
    setAccessToken: vi.fn(),
    setTokens: vi.fn(),
  },
}));

vi.mock('../../helpers/CentralWebHelper', () => ({
  default: { postAsync: vi.fn() },
}));

vi.mock('../../helpers/WebHelper', () => ({
  default: { getAsync: vi.fn(() => Promise.resolve({})) },
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

import WebRTCManagerInstance from './WebRTCManager';

describe('WebRTCManager', () => {
  beforeEach(async () => {
    signalingHandlers.clear();
    vi.clearAllMocks();
    WebRTCManagerInstance.Close();
    await WebRTCManagerInstance.Start('session-1', vi.fn());
  });

  afterEach(() => {
    WebRTCManagerInstance.Close();
  });

  // Regression: PEER_LEFT used to only set WebSocketReady=false, leaving
  // _dataChannel/_pc alive — isChannelReady() (which checks readyState, not
  // WebSocketReady) kept reporting "ready" until the browser noticed on its own.
  describe('PEER_LEFT handling', () => {
    it('closes the data channel and peer connection, and isChannelReady() reports false immediately', () => {
      WebRTCManagerInstance._gmPeerId = 'gm-1';
      const fakeDataChannel = { readyState: 'open', close: vi.fn() };
      const fakePc = { close: vi.fn() };
      WebRTCManagerInstance._dataChannel = fakeDataChannel;
      WebRTCManagerInstance._pc = fakePc;
      WebRTCManagerInstance.WebSocketReady = true;

      const peerLeftHandler = signalingHandlers.get('peer-left');
      expect(peerLeftHandler).toBeInstanceOf(Function);

      peerLeftHandler({ peerId: 'gm-1' });

      expect(fakeDataChannel.close).toHaveBeenCalledTimes(1);
      expect(fakePc.close).toHaveBeenCalledTimes(1);
      expect(WebRTCManagerInstance._dataChannel).toBeNull();
      expect(WebRTCManagerInstance._pc).toBeNull();
      expect(WebRTCManagerInstance.WebSocketReady).toBe(false);
      expect(WebRTCManagerInstance.isChannelReady()).toBe(false);
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
});
