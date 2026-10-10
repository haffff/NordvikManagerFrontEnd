import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    // FakeAudio.blocked: the browser's autoplay policy refuses until the player interacts.
    if (FakeAudio.blocked) return Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
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
FakeAudio.blocked = false;

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

// Lets every fade (start/stop ~0.5 s, volume ramps ~0.3 s) and pending load finish.
const settle = () => vi.advanceTimersByTimeAsync(1000);

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

  it('disposes the element on sound_stop (after fading it out) and allows a fresh one afterwards', async () => {
    vi.useFakeTimers();
    await mount();

    subscriptions.sound({ command: 'sound_play', data: { resourceId: 'r1' } });
    await Promise.resolve();
    await Promise.resolve();
    const first = FakeAudio.instances[0];

    subscriptions.sound({ command: 'sound_stop', data: { resourceId: 'r1' } });
    await settle();

    expect(first.paused).toBe(true);
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();

    subscriptions.sound({ command: 'sound_play', data: { resourceId: 'r1' } });
    await Promise.resolve();
    await Promise.resolve();

    expect(FakeAudio.instances).toHaveLength(2); // rebuilt from scratch
    expect(getMaterialAsyncMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
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

// The browser refuses audio until the player clicks or presses a key on the page.
describe('PlaybackManager — autoplay blocked', () => {
  const click = () => document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  const flush = () => new Promise((r) => setTimeout(r, 0));
  beforeEach(() => { FakeAudio.blocked = true; });
  afterEach(() => { FakeAudio.blocked = false; click(); });

  it('starts a refused playlist track on the first click, at the point it has reached by then', async () => {
    const { findByText } = await mount();
    subscriptions.playlist({
      command: 'playlist_play',
      data: { playlistId: 'p1', mode: 0, trackOrder: ['t1'], currentTrackIndex: 0, repeat: false, currentTrackStartedAtUtc: new Date(Date.now() - 30_000).toISOString() },
    });
    await flush();
    const track = FakeAudio.instances[0];
    expect(track.paused).toBe(true);
    await findByText(/click anywhere to enable sound/i);

    FakeAudio.blocked = false;
    click();

    expect(track.paused).toBe(false);
    expect(track.currentTime).toBeGreaterThanOrEqual(30);
  });

  it('does not start a track the GM paused while it waited', async () => {
    await mount();
    subscriptions.playlist({ command: 'playlist_play', data: { playlistId: 'p1', mode: 0, trackOrder: ['t1'], currentTrackIndex: 0, repeat: false } });
    await flush();

    subscriptions.playlist({ command: 'playlist_pause', data: { playlistId: 'p1' } });
    FakeAudio.blocked = false;
    click();

    expect(FakeAudio.instances[0].paused).toBe(true);
  });

  it('drops a refused sound effect instead of playing it late', async () => {
    await mount();
    subscriptions.sound({ command: 'sound_play', data: { resourceId: 'r1' } });
    await flush();

    FakeAudio.blocked = false;
    click();

    expect(FakeAudio.instances[0].paused).toBe(true);
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

describe("PlaybackManager — the player's volume", () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it('plays music and sound effects at their own volumes', async () => {
    const { setVolume } = await import('../../helpers/audioVolume');
    setVolume('music', 0.3);
    setVolume('sounds', 0.6);
    await mount();

    subscriptions.playlist({ command: 'playlist_play', data: { playlistId: 'p1', mode: 0, trackOrder: ['t1'], currentTrackIndex: 0, repeat: false } });
    subscriptions.sound({ command: 'sound_play', data: { resourceId: 'r1' } });
    await settle();

    expect(FakeAudio.instances.map((a) => a.volume)).toEqual([0.3, 0.6]);
  });

  it('changing a volume applies to what is already playing, of that kind only', async () => {
    const { setVolume } = await import('../../helpers/audioVolume');
    await mount();
    subscriptions.playlist({ command: 'playlist_play', data: { playlistId: 'p1', mode: 0, trackOrder: ['t1'], currentTrackIndex: 0, repeat: false } });
    subscriptions.sound({ command: 'sound_play', data: { resourceId: 'r1' } });

    await settle();
    setVolume('music', 0.1);
    await settle();

    expect(FakeAudio.instances.map((a) => a.volume)).toEqual([0.1, 1]);
  });
});

describe("PlaybackManager — the GM's volumes", () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());
  const play = (extra) => subscriptions.playlist({ command: 'playlist_play', data: { playlistId: 'p1', mode: 0, trackOrder: ['t1'], currentTrackIndex: 0, repeat: false, ...extra } });

  it("plays a track at the playlist's volume times the file's own", async () => {
    await mount();

    play({ volume: 0.8, trackVolumes: { t1: 0.5 } });
    await settle();

    expect(FakeAudio.instances[0].volume).toBeCloseTo(0.4);
  });

  it('follows the GM changing the playlist volume while it plays, and the player their own', async () => {
    const { setVolume } = await import('../../helpers/audioVolume');
    await mount();
    play({ volume: 0.8, trackVolumes: { t1: 0.5 } });
    await settle();

    subscriptions.playlist({ command: 'playlist_volume', data: { playlistId: 'p1', volume: 0.5 } });
    await settle();
    expect(FakeAudio.instances[0].volume).toBeCloseTo(0.25);

    setVolume('music', 0.5);
    await settle();
    expect(FakeAudio.instances[0].volume).toBeCloseTo(0.125);
  });

  it('keeps the volumes for the next track of the playlist', async () => {
    await mount();
    play({ trackOrder: ['t1', 't2'], volume: 0.5, trackVolumes: { t2: 0.4 } });

    subscriptions.playlist({ command: 'playlist_track_change', data: { playlistId: 'p1', trackId: 't2', trackIndex: 1, trackOrder: ['t1', 't2'] } });
    await settle();

    expect(FakeAudio.instances[1].volume).toBeCloseTo(0.2);
  });

  it("plays a sound at the volume the server sent", async () => {
    await mount();

    subscriptions.sound({ command: 'sound_play', data: { resourceId: 'r1', volume: 0.3 } });
    await settle();

    expect(FakeAudio.instances[0].volume).toBeCloseTo(0.3);
  });
});

// Start, stop and track changes fade; pause and resume are instant; sound effects
// start at full volume.
describe('PlaybackManager — fades', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());
  const play = (extra) => subscriptions.playlist({ command: 'playlist_play', data: { playlistId: 'p1', mode: 0, trackOrder: ['t1', 't2'], currentTrackIndex: 0, repeat: false, ...extra } });
  const loaded = () => vi.advanceTimersByTimeAsync(0);

  it('music fades in when it starts', async () => {
    await mount();
    play();
    await loaded();
    const track = FakeAudio.instances[0];

    expect(track.paused).toBe(false);
    expect(track.volume).toBeLessThan(0.2);
    await settle();
    expect(track.volume).toBeCloseTo(1);
  });

  it('stopping fades out before the track is paused and released', async () => {
    await mount();
    play();
    await settle();
    const track = FakeAudio.instances[0];

    subscriptions.playlist({ command: 'playlist_stop', data: { playlistId: 'p1' } });
    await vi.advanceTimersByTimeAsync(200);
    expect(track.paused).toBe(false);
    expect(track.volume).toBeLessThan(1);

    await settle();
    expect(track.paused).toBe(true);
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('the next track takes over with a quick dip: the old fades out, the new fades in', async () => {
    await mount();
    play();
    await settle();
    const first = FakeAudio.instances[0];

    subscriptions.playlist({ command: 'playlist_track_change', data: { playlistId: 'p1', trackId: 't2', trackIndex: 1, trackOrder: ['t1', 't2'] } });
    await loaded();
    expect(first.paused).toBe(false); // still fading out
    expect(FakeAudio.instances[1].volume).toBeLessThan(0.2);

    await settle();
    expect(first.paused).toBe(true);
    expect(FakeAudio.instances[1].volume).toBeCloseTo(1);
  });

  it('pause and resume are instant', async () => {
    await mount();
    play();
    await settle();
    const track = FakeAudio.instances[0];

    subscriptions.playlist({ command: 'playlist_pause', data: { playlistId: 'p1' } });
    expect(track.paused).toBe(true);
    play();
    expect(track.paused).toBe(false);
    expect(track.volume).toBeCloseTo(1);
  });

  it('a sound effect starts at full volume, without a fade-in', async () => {
    await mount();
    subscriptions.sound({ command: 'sound_play', data: { resourceId: 'r1' } });
    await loaded();

    expect(FakeAudio.instances[0].volume).toBe(1);
  });
});
