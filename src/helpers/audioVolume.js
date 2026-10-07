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

/** Sets an audio element's volume for its category, and remembers the category on it. */
export function applyVolume(audio, category) {
  if (!audio) return audio;
  audio.__volumeCategory = category;
  audio.volume = getVolume(category);
  return audio;
}
