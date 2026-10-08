import * as React from "react";
import { ActiveWebHelper as WebHelper } from "../../helpers/transport";
import Subscribable from "../uiComponents/base/Subscribable";
import { usePermissions } from "../../contexts/PermissionsContext";
import ClientMediator from "../../ClientMediator";
import { SYSTEM_ASSET_KEYS, playSystemSound } from "../../helpers/systemAssets";
import { applyVolume, fadeIn, fadeOut, onVolumeChange, refreshVolume, setGmVolume } from "../../helpers/audioVolume";
import PlaylistService from "./PlaylistService";

// Always-mounted singleton (see Game.js) that owns actual audio playback for the
// soundboard and playlist player. It is not a panel — it keeps playing regardless of
// which dockable panels are open or closed.
//
// Audio is built with plain `new Audio()` (headless, no DOM mount needed).
//
// Exactly one connected client — the GM's own browser — drives Sequential track-advance
// and Concurrent+Repeat=false end-of-playback. Every other client just reacts to the
// resulting broadcasts. This prevents every connected client from racing to call
// AdvanceTrack/StopPlaylist simultaneously.
export const PlaybackManager = () => {
  const { isGM } = usePermissions();
  const isGMRef = React.useRef(isGM);
  isGMRef.current = isGM;

  // Set once on mount (mirrors ChatPanel's own lookup) — used only to skip playing
  // the incoming-message sound for messages this client itself just sent.
  const currentPlayerIdRef = React.useRef(undefined);
  React.useEffect(() => {
    currentPlayerIdRef.current = ClientMediator.sendCommand("Game", "GetCurrentPlayer", {})?.id;
  }, []);

  // Registered here (rather than inside PlaylistsPanel/SoundboardPanel) so
  // Playlist CRUD/playback commands stay reachable while those panels are closed.
  React.useEffect(() => {
    ClientMediator.register(PlaylistService);
  }, []);

  // playlistId -> { mode, repeat, trackOrder, currentTrackIndex, elements: {trackId: Audio}, endedTrackIds: Set }
  const playlistsRef = React.useRef({});
  // resourceId -> Audio, for soundboard one-shots
  const soundsRef = React.useRef({});

  const safePlay = (audio) => {
    audio.play()?.catch((e) => {
      console.warn("[PlaybackManager] audio.play() blocked (likely browser autoplay policy):", e?.message ?? e);
    });
  };

  // disposeAudio() flags the element BEFORE pausing it, synchronously — this is checked
  // by the pending getMaterialAsync().then() below so a blob that resolves *after*
  // teardown/track-change can't set .src and start playback on an element nothing holds
  // a reference to anymore (a real race over the WebRTC tunnel, whose 15KB-chunked
  // transfer + up to 30s timeout leaves a wide window for this to happen).
  const disposeAudio = (audio) => {
    audio.__disposed = true;
    audio.pause();
    if (audio.src) URL.revokeObjectURL(audio.src);
  };

  // Stop, track change: fade out, then dispose. Flagged disposed at once, so a track
  // still loading never starts. A paused element (nothing to hear) goes at once.
  const fadeOutAndDispose = (audio) => {
    audio.__disposed = true;
    if (audio.paused) {
      disposeAudio(audio);
      return;
    }
    fadeOut(audio, () => disposeAudio(audio));
  };

  // category: which of the player's volumes applies ("music" or "sounds");
  // gmVolume: the GM's for this element (playlist or soundboard, times the file's own).
  // fadeInOnStart: music fades in; a sound effect starts at once (a door slam needs its attack).
  const buildTrackElement = (trackId, { loop, seekFromUtc, onEnded, category = "music", gmVolume = 1, fadeInOnStart = category === "music" }) => {
    const audio = applyVolume(new Audio(), category, gmVolume);
    audio.__disposed = false;
    audio.loop = loop;
    if (onEnded) audio.addEventListener("ended", onEnded);
    if (seekFromUtc) {
      audio.addEventListener("loadedmetadata", () => {
        const elapsedSeconds = Math.max(0, (Date.now() - Date.parse(seekFromUtc)) / 1000);
        if (Number.isFinite(elapsedSeconds) && elapsedSeconds < (audio.duration || Infinity)) {
          audio.currentTime = elapsedSeconds;
        }
      });
    }
    // Deliberately bypasses getResourceBlobAsync()'s in-memory session cache — it has no
    // eviction and is sized for repeated canvas image loads, not audio tracks. Tracks are
    // still kept between plays: getMaterialAsync goes through ResourceCache (in the browser,
    // size-limited, least recently used dropped first), so a replayed track is only
    // checked with the server, not downloaded again. Each play gets its own object URL
    // below, released in disposeAudio().
    WebHelper.getMaterialAsync(trackId)
      .then((blob) => {
        if (audio.__disposed || !(blob instanceof Blob)) return;
        audio.src = URL.createObjectURL(blob);
        if (fadeInOnStart) fadeIn(audio);
        safePlay(audio);
      })
      .catch((e) => console.warn("[PlaybackManager] failed to fetch track blob:", e?.message ?? e));
    return audio;
  };

  // immediate: on unmount, nothing is left to fade.
  const teardownPlaylist = (playlistId, { immediate = false } = {}) => {
    const entry = playlistsRef.current[playlistId];
    if (!entry) return;
    Object.values(entry.elements).forEach(immediate ? disposeAudio : fadeOutAndDispose);
    delete playlistsRef.current[playlistId];
  };

  // fromTrackIndex is the index this exact track element was built for (captured at
  // build time, not read live off entry.currentTrackIndex) — the backend no-ops the
  // call if that no longer matches its authoritative state, making duplicate Advance
  // calls (e.g. two GM tabs both open) harmless instead of double-skipping a track.
  const advanceSequential = (playlistId, fromTrackIndex) => {
    if (!isGMRef.current) return;
    WebHelper.postAsync("Playlist/AdvanceTrack", { PlaylistId: playlistId, FromTrackIndex: fromTrackIndex });
  };

  const maybeEndConcurrent = (playlistId) => {
    const entry = playlistsRef.current[playlistId];
    if (!entry || entry.mode !== 1 /* Concurrent */) return;
    if (entry.endedTrackIds.size < entry.trackOrder.length) return;
    if (!isGMRef.current) return;
    WebHelper.postAsync("Playlist/StopPlaylist", { PlaylistId: playlistId });
  };

  const trackGmVolume = (entry, trackId) => (entry.volume ?? 1) * (entry.trackVolumes?.[trackId] ?? 1);

  const startPlaylist = (data) => {
    teardownPlaylist(data.playlistId);

    const entry = {
      mode: data.mode,
      repeat: data.repeat,
      trackOrder: data.trackOrder ?? [],
      currentTrackIndex: data.currentTrackIndex ?? 0,
      elements: {},
      endedTrackIds: new Set(),
      // The GM's: the playlist's volume, and files with a volume of their own.
      volume: data.volume ?? 1,
      trackVolumes: data.trackVolumes ?? {},
    };
    playlistsRef.current[data.playlistId] = entry;

    if (data.mode === 1 /* Concurrent */) {
      entry.trackOrder.forEach((trackId) => {
        entry.elements[trackId] = buildTrackElement(trackId, {
          loop: data.repeat,
          gmVolume: trackGmVolume(entry, trackId),
          seekFromUtc: data.currentTrackStartedAtUtc,
          onEnded: data.repeat
            ? undefined
            : () => {
                entry.endedTrackIds.add(trackId);
                maybeEndConcurrent(data.playlistId);
              },
        });
      });
    } else {
      const trackId = entry.trackOrder[entry.currentTrackIndex];
      if (trackId) {
        const fromIndex = entry.currentTrackIndex;
        entry.elements[trackId] = buildTrackElement(trackId, {
          loop: false,
          gmVolume: trackGmVolume(entry, trackId),
          seekFromUtc: data.currentTrackStartedAtUtc,
          onEnded: () => advanceSequential(data.playlistId, fromIndex),
        });
      }
    }
  };

  const pausePlaylist = (playlistId) => {
    const entry = playlistsRef.current[playlistId];
    if (!entry) return;
    Object.values(entry.elements).forEach((audio) => audio.pause());
  };

  const resumePlaylist = (playlistId) => {
    const entry = playlistsRef.current[playlistId];
    if (!entry) return;
    Object.values(entry.elements).forEach((audio) => safePlay(audio));
  };

  const changeTrack = (data) => {
    const entry = playlistsRef.current[data.playlistId];
    if (!entry) return;

    // Sequential only — fade out the previous single track element (the next fades in).
    Object.values(entry.elements).forEach(fadeOutAndDispose);
    entry.elements = {};
    entry.trackOrder = data.trackOrder ?? entry.trackOrder;
    entry.currentTrackIndex = data.trackIndex ?? 0;

    const trackId = data.trackId;
    if (trackId) {
      const fromIndex = entry.currentTrackIndex;
      entry.elements[trackId] = buildTrackElement(trackId, {
        loop: false,
        gmVolume: trackGmVolume(entry, trackId),
        seekFromUtc: data.currentTrackStartedAtUtc,
        onEnded: () => advanceSequential(data.playlistId, fromIndex),
      });
    }
  };

  // The GM changed a playing playlist's volume.
  const changePlaylistVolume = (data) => {
    const entry = playlistsRef.current[data.playlistId];
    if (!entry) return;
    entry.volume = data.volume ?? 1;
    Object.entries(entry.elements).forEach(([trackId, audio]) => setGmVolume(audio, trackGmVolume(entry, trackId)));
  };

  const onPlaylistEvent = React.useCallback((event) => {
    const data = event?.data ?? {};
    switch (event?.command) {
      case "playlist_play": {
        // If we already have local state for this playlist, this Play is a resume-in-place
        // (the only way local state survives is a prior Pause — Stop always tears it down)
        // — just unpause rather than rebuilding elements from scratch.
        if (playlistsRef.current[data.playlistId]) {
          resumePlaylist(data.playlistId);
        } else {
          startPlaylist(data);
        }
        break;
      }
      case "playlist_pause":
        pausePlaylist(data.playlistId);
        break;
      case "playlist_stop":
        teardownPlaylist(data.playlistId);
        break;
      case "playlist_track_change":
        changeTrack(data);
        break;
      case "playlist_volume":
        changePlaylistVolume(data);
        break;
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSoundEvent = React.useCallback((event) => {
    const data = event?.data ?? {};
    switch (event?.command) {
      case "sound_play": {
        const existing = soundsRef.current[data.resourceId];
        if (existing) {
          // Restart in place rather than layering a second overlapping instance.
          existing.currentTime = 0;
          safePlay(existing);
          break;
        }
        const audio = buildTrackElement(data.resourceId, { loop: false, category: "sounds", gmVolume: data.volume ?? 1 });
        audio.addEventListener("ended", () => {
          if (audio.src) URL.revokeObjectURL(audio.src);
          delete soundsRef.current[data.resourceId];
        });
        soundsRef.current[data.resourceId] = audio;
        break;
      }
      case "sound_stop": {
        const audio = soundsRef.current[data.resourceId];
        if (audio) {
          fadeOutAndDispose(audio);
          delete soundsRef.current[data.resourceId];
        }
        break;
      }
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chat notification sound — skips the sender's own client so sending a message
  // doesn't ding yourself. Lives here (always-mounted) rather than in ChatPanel so
  // it plays even when the chat panel isn't open.
  const onChatMessage = React.useCallback((event) => {
    if (event?.playerId !== undefined && event.playerId === currentPlayerIdRef.current) return;
    playSystemSound(SYSTEM_ASSET_KEYS.CHAT_MESSAGE_SOUND);
  }, []);

  // The player changed a volume in Player Settings: apply it to what's playing now.
  React.useEffect(() => onVolumeChange((category, volume) => {
    const playing = [
      ...Object.values(playlistsRef.current).flatMap((entry) => Object.values(entry.elements)),
      ...Object.values(soundsRef.current),
    ];
    playing.forEach((audio) => {
      if (audio?.__volumeCategory === category) refreshVolume(audio);
    });
  }), []);

  // Resync on mount — pick up any playlists already playing when this client (re)connects.
  React.useEffect(() => {
    WebHelper.getAsync("Playlist/GetCurrentPlayback")
      .then((data) => {
        if (!Array.isArray(data)) return;
        data.forEach((state) => {
          if (!state.isPaused) startPlaylist(state);
        });
      })
      .catch((e) => console.warn("[PlaybackManager] failed to fetch current playback:", e?.message ?? e));

    return () => {
      Object.keys(playlistsRef.current).forEach((id) => teardownPlaylist(id, { immediate: true }));
      Object.values(soundsRef.current).forEach(disposeAudio);
      soundsRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Subscribable commandPrefix="playlist" onMessage={onPlaylistEvent} />
      <Subscribable commandPrefix="sound" onMessage={onSoundEvent} />
      <Subscribable commandPrefix="chat" onMessage={onChatMessage} />
    </>
  );
};

export default PlaybackManager;
