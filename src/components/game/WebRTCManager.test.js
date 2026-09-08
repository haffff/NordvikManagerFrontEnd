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
});
