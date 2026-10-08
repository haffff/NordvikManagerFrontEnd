// How loud each kind of sound plays for this player. Kept in this browser (like
// personal stylesheets), for every game, and set in Player Settings. 0 = muted.

export const AUDIO_CATEGORIES = Object.freeze([
  { key: "music", label: "Music", description: "Playlists the GM plays." },
  { key: "sounds", label: "Sound effects", description: "Soundboard sounds." },
  { key: "notifications", label: "Notifications", description: "The new chat message sound." },
]);

const STORAGE_KEY = "nm_audio_volume";
const listeners = new Set();

const clamp = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
};

function readAll() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
}

/** 0..1, 1 until the player changes it. */
export function getVolume(category) {
  const stored = readAll()[category];
  return stored === undefined ? 1 : clamp(stored);
}

export function setVolume(category, value) {
  const volume = clamp(value);
  const all = { ...readAll(), [category]: volume };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable (private mode): still applies for this session through the listeners.
  }
  listeners.forEach((listener) => listener(category, volume));
}

/** Calls back with (category, volume) on every change; returns the unsubscribe. */
export function onVolumeChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Fades: starting and stopping fade (no click from cutting a waveform, and a soft
// start hides each browser beginning a track a moment apart); volume changes ramp.
// Pausing and resuming stay instant.
export const FADE_MS = 500;
export const RAMP_MS = 300;
const STEP_MS = 20;

/** The volume an element should play at: the GM's for it times this player's. */
const targetOf = (audio) => (audio.__gmVolume ?? 1) * getVolume(audio.__volumeCategory ?? "music");

const cancelFade = (audio) => {
  if (audio.__fade) clearInterval(audio.__fade);
  audio.__fade = undefined;
};

/** Ramps the element's volume to `target` over `ms`, replacing any fade still running. */
export function fadeTo(audio, target, ms, onDone) {
  if (!audio) return;
  cancelFade(audio);
  const from = Number.isFinite(audio.volume) ? audio.volume : 0;
  const to = clamp(target);
  if (ms <= 0 || from === to) {
    audio.volume = to;
    onDone?.();
    return;
  }
  const started = Date.now();
  audio.__fade = setInterval(() => {
    const t = Math.min(1, (Date.now() - started) / ms);
    // Ends exactly on the target, not a float's width off it.
    audio.volume = t >= 1 ? to : clamp(from + (to - from) * t);
    if (t >= 1) {
      cancelFade(audio);
      onDone?.();
    }
  }, STEP_MS);
}

/** From silence up to the volume it should play at. */
export function fadeIn(audio, ms = FADE_MS) {
  if (!audio) return;
  cancelFade(audio);
  audio.volume = 0;
  fadeTo(audio, targetOf(audio), ms);
}

/** Down to silence, then onDone (e.g. pause and release the element). */
export function fadeOut(audio, onDone, ms = FADE_MS) {
  fadeTo(audio, 0, ms, onDone);
}

/**
 * Sets an audio element's volume: the GM's volume for it (playlist / soundboard and
 * file, 0..1) times this player's for its category. Both are remembered on the element,
 * so either can change later (setGmVolume, or a player change via onVolumeChange).
 */
export function applyVolume(audio, category, gmVolume = 1) {
  if (!audio) return audio;
  cancelFade(audio);
  audio.__volumeCategory = category;
  audio.__gmVolume = clamp(gmVolume);
  audio.volume = targetOf(audio);
  return audio;
}

/** The GM changed the volume of something playing: ramp to it. */
export function setGmVolume(audio, gmVolume) {
  if (!audio) return;
  audio.__gmVolume = clamp(gmVolume);
  audio.__volumeCategory ??= "music";
  fadeTo(audio, targetOf(audio), RAMP_MS);
}

/** Re-applies this player's volume (after a change) to an element, keeping the GM's: ramps to it. */
export function refreshVolume(audio) {
  if (!audio?.__volumeCategory) return;
  fadeTo(audio, targetOf(audio), RAMP_MS);
}
