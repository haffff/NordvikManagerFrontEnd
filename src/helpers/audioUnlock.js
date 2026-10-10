// Browsers refuse audio.play() until the player has clicked or pressed a key on the page
// (the autoplay policy; every page load starts locked). Audio refused that way waits here
// and starts on the first click or key press — play() has to be called inside that event.
const waiting = new Map(); // audio element -> onUnlock(audio), run just before it plays
const listeners = new Set();
const GESTURES = ['pointerdown', 'keydown'];

const notify = () => listeners.forEach((listener) => listener(waiting.size));

function unlock() {
  const entries = [...waiting];
  waiting.clear();
  GESTURES.forEach((type) => document.removeEventListener(type, unlock, true));
  notify();
  for (const [audio, onUnlock] of entries) {
    if (audio.__disposed) continue;
    onUnlock?.(audio);
    audio.play()?.catch((e) => console.warn('[audioUnlock] audio.play() failed after unlock:', e?.message ?? e));
  }
}

/** Plays the element; if the autoplay policy refuses, plays it on the player's first click or key press. */
export function playOrWait(audio, onUnlock) {
  return audio.play()?.catch((e) => {
    if (e?.name !== 'NotAllowedError') {
      console.warn('[audioUnlock] audio.play() failed:', e?.message ?? e);
      return;
    }
    if (audio.__disposed) return;
    if (waiting.size === 0) GESTURES.forEach((type) => document.addEventListener(type, unlock, true));
    waiting.set(audio, onUnlock);
    notify();
  });
}

/** The element no longer should start (paused, stopped). */
export function forgetWaiting(audio) {
  if (waiting.delete(audio)) notify();
}

export const waitingCount = () => waiting.size;

/** listener(count) on every change; returns the unsubscribe. */
export function onWaitingChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
