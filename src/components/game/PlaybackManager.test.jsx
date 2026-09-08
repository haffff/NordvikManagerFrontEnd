import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// PlaybackManager renders no visible DOM of its own — it just mounts three
// <Subscribable> elements. Capture each one's onMessage callback (keyed by
// commandPrefix) so tests can fire synthetic WS events directly, the same way
// Game.js's real Subscribable would after a matching broadcast arrives.
const { subscriptions } = vi.hoisted(() => ({ subscriptions: {} }));
vi.mock('../uiComponents/base/Subscribable', () => ({
  default: ({ commandPrefix, onMessage }) => {
    subscriptions[commandPrefix] = onMessage;
    return null;
  },
}));

const { getMaterialAsyncMock, postAsyncMock } = vi.hoisted(() => ({
  getMaterialAsyncMock: vi.fn(),
  postAsyncMock: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../helpers/transport', () => ({
  ActiveWebHelper: {
    getMaterialAsync: getMaterialAsyncMock,
    postAsync: postAsyncMock,
    getAsync: vi.fn(() => Promise.resolve([])),
  },
}));

const { sendCommandMock, registerMock } = vi.hoisted(() => ({
  sendCommandMock: vi.fn(() => ({ id: 'me' })),
  registerMock: vi.fn(),
}));
vi.mock('../../ClientMediator', () => ({
  default: { sendCommand: sendCommandMock, register: registerMock },
}));

vi.mock('../../contexts/PermissionsContext', () => ({
  usePermissions: () => ({ isGM: true }),
}));

const { playSystemSoundMock } = vi.hoisted(() => ({ playSystemSoundMock: vi.fn() }));
vi.mock('../../helpers/systemAssets', () => ({
  SYSTEM_ASSET_KEYS: { CHAT_MESSAGE_SOUND: 'chat_message_sound' },
  playSystemSound: playSystemSoundMock,
}));

vi.mock('./PlaylistService', () => ({ default: {} }));

import { PlaybackManager } from './PlaybackManager';

// Minimal controllable stand-in for the DOM Audio element — jsdom doesn't implement
// real media playback. Tracks every instance created so tests can assert on how many
// (and which) elements PlaybackManager builds, and lets tests fire 'ended'/
// 'loadedmetadata' synthetically.
class FakeAudio {
  constructor() {
    this.paused = true;
    this.currentTime = 0;
    this.loop = false;
    this.src = '';
    this._listeners = {};
    FakeAudio.instances.push(this);
  }
  addEventListener(evt, cb) {
    (this._listeners[evt] ||= []).push(cb);
  }
  removeEventListener() {}
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  fireEnded() {
    (this._listeners.ended || []).forEach((cb) => cb());
  }
}
FakeAudio.instances = [];

/** A getMaterialAsync() call the test controls the resolution timing of. */
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  FakeAudio.instances = [];
  global.Audio = FakeAudio;
  global.URL.createObjectURL = vi.fn(() => 'blob:fake-url');
  global.URL.revokeObjectURL = vi.fn();
  getMaterialAsyncMock.mockImplementation(() => Promise.resolve(new Blob(['x'])));
});

async function mount() {
  const utils = render(<PlaybackManager />);
  // Flush the mount effects (GetCurrentPlayer lookup, PlaylistService registration).
  await Promise.resolve();
  return utils;
}

describe('PlaybackManager — soundboard one-shots', () => {
  it('fetches the resource and plays it on sound_play for a new resource', async () => {
    await mount();

    subscriptions.sound({ command: 'sound_play', data: { resourceId: 'r1' } });
    await Promise.resolve();
    await Promise.resolve();

    expect(getMaterialAsyncMock).toHaveBeenCalledWith('r1');
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].src).toBe('blob:fake-url');
    expect(FakeAudio.instances[0].paused).toBe(false);
  });

  it('restarts the existing element in place on a repeat sound_play, without refetching', async () => {
    await mount();

    subscriptions.sound({ command: 'sound_play', data: { resourceId: 'r1' } });
    await Promise.resolve();
    await Promise.resolve();
    const instance = FakeAudio.instances[0];
    instance.currentTime = 5;

    subscriptions.sound({ command: 'sound_play', data: { resourceId: 'r1' } });

    expect(FakeAudio.instances).toHaveLength(1); // no second element built
    expect(getMaterialAsyncMock).toHaveBeenCalledTimes(1); // no refetch
    expect(instance.currentTime).toBe(0); // restarted from the top
    expect(instance.paused).toBe(false);
  });

  it('disposes the element on sound_stop and allows a fresh one afterwards', async () => {
    await mount();

    subscriptions.sound({ command: 'sound_play', data: { resourceId: 'r1' } });
    await Promise.resolve();
    await Promise.resolve();
    const first = FakeAudio.instances[0];

    subscriptions.sound({ command: 'sound_stop', data: { resourceId: 'r1' } });

    expect(first.paused).toBe(true);
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();

    subscriptions.sound({ command: 'sound_play', data: { resourceId: 'r1' } });
    await Promise.resolve();
    await Promise.resolve();

    expect(FakeAudio.instances).toHaveLength(2); // rebuilt from scratch
    expect(getMaterialAsyncMock).toHaveBeenCalledTimes(2);
  });

  it('does not set .src or play() when the blob resolves after the element was already disposed (teardown race)', async () => {
    await mount();
    const { promise, resolve } = deferred();
    getMaterialAsyncMock.mockReturnValueOnce(promise);

    subscriptions.sound({ command: 'sound_play', data: { resourceId: 'r1' } });
    const instance = FakeAudio.instances[0];

    // Disposed (e.g. by a sound_stop, or a track/playlist change) before the fetch resolves.
    subscriptions.sound({ command: 'sound_stop', data: { resourceId: 'r1' } });
    expect(instance.paused).toBe(true);

    resolve(new Blob(['late']));
    await Promise.resolve();
    await Promise.resolve();

    expect(instance.src).toBe(''); // never set
    expect(instance.paused).toBe(true); // never (re)started
  });
});

describe('PlaybackManager — playlists', () => {
  const sequentialPlay = (overrides = {}) => ({
    command: 'playlist_play',
    data: {
      playlistId: 'p1',
      mode: 0, // Sequential
      trackOrder: ['t1', 't2'],
      currentTrackIndex: 0,
      repeat: false,
      ...overrides,
    },
  });

  it('builds and plays the current track on playlist_play for a new playlist', async () => {
    await mount();

    subscriptions.playlist(sequentialPlay());
    await Promise.resolve();
    await Promise.resolve();

    expect(getMaterialAsyncMock).toHaveBeenCalledWith('t1');
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].paused).toBe(false);
  });

  it('resumes in place on a second playlist_play after a pause, without rebuilding or refetching', async () => {
    await mount();
    subscriptions.playlist(sequentialPlay());
    await Promise.resolve();
    await Promise.resolve();
    const instance = FakeAudio.instances[0];

    subscriptions.playlist({ command: 'playlist_pause', data: { playlistId: 'p1' } });
    expect(instance.paused).toBe(true);

    subscriptions.playlist(sequentialPlay());

    expect(FakeAudio.instances).toHaveLength(1); // same element, not rebuilt
    expect(getMaterialAsyncMock).toHaveBeenCalledTimes(1); // no refetch
    expect(instance.paused).toBe(false); // resumed
  });

  it('tears down all elements on playlist_stop, so the next play rebuilds from scratch', async () => {
    await mount();
    subscriptions.playlist(sequentialPlay());
    await Promise.resolve();
    await Promise.resolve();
    const first = FakeAudio.instances[0];

    subscriptions.playlist({ command: 'playlist_stop', data: { playlistId: 'p1' } });
    expect(first.paused).toBe(true);
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();

    subscriptions.playlist(sequentialPlay());
    await Promise.resolve();
    await Promise.resolve();

    expect(FakeAudio.instances).toHaveLength(2);
    expect(getMaterialAsyncMock).toHaveBeenCalledTimes(2);
  });

  it('requests AdvanceTrack when the current (sequential) track ends, as the GM', async () => {
    await mount();
    subscriptions.playlist(sequentialPlay());
    await Promise.resolve();
    await Promise.resolve();

    FakeAudio.instances[0].fireEnded();

    expect(postAsyncMock).toHaveBeenCalledWith('Playlist/AdvanceTrack', { PlaylistId: 'p1', FromTrackIndex: 0 });
  });

  it('requests StopPlaylist only once every concurrent track has ended', async () => {
    await mount();
    subscriptions.playlist({
      command: 'playlist_play',
      data: { playlistId: 'p1', mode: 1 /* Concurrent */, trackOrder: ['t1', 't2'], repeat: false },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(FakeAudio.instances).toHaveLength(2);

    FakeAudio.instances[0].fireEnded();
    expect(postAsyncMock).not.toHaveBeenCalledWith('Playlist/StopPlaylist', expect.anything());

    FakeAudio.instances[1].fireEnded();
    expect(postAsyncMock).toHaveBeenCalledWith('Playlist/StopPlaylist', { PlaylistId: 'p1' });
  });

  it('disposes every active playlist and sound on unmount', async () => {
    const { unmount } = await mount();
    subscriptions.playlist(sequentialPlay());
    subscriptions.sound({ command: 'sound_play', data: { resourceId: 'r1' } });
    await Promise.resolve();
    await Promise.resolve();
    expect(FakeAudio.instances).toHaveLength(2);

    unmount();

    expect(FakeAudio.instances.every((a) => a.paused)).toBe(true);
  });
});

describe('PlaybackManager — chat notification sound', () => {
  it('skips playing the notification sound for the current player\'s own message', async () => {
    await mount(); // GetCurrentPlayer resolves to { id: 'me' } per the mock above

    subscriptions.chat({ playerId: 'me' });

    expect(playSystemSoundMock).not.toHaveBeenCalled();
  });

  it('plays the notification sound for another player\'s message', async () => {
    await mount();

    subscriptions.chat({ playerId: 'someone-else' });

    expect(playSystemSoundMock).toHaveBeenCalledWith('chat_message_sound');
  });
});
