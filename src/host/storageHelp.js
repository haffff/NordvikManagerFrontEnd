// Helpers for the host build's persistent storage (the games are in this browser's OPFS).
import { useEffect, useState } from 'react';

/**
 * Asks once, on the first click anywhere: Firefox shows its "keep data" prompt only when
 * persist() is called during a click. Returns a function that stops waiting.
 * @param ask       () => Promise<boolean>, e.g. navigator.storage.persist
 * @param onAnswer  the browser's answer
 */
export function askOnFirstClick(target, ask, onAnswer) {
  const handler = () => {
    target.removeEventListener('pointerdown', handler, true);
    Promise.resolve()
      .then(ask)
      .then((granted) => onAnswer(!!granted), () => {});
  };
  target.addEventListener('pointerdown', handler, true);
  return () => target.removeEventListener('pointerdown', handler, true);
}

/** 1536 -> "1.5 KB", 34603013 -> "33 MB". */
export function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const shown = value >= 10 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${shown} ${units[unit]}`;
}

/** { usage, quota } of this site's storage, asked again whenever `when` changes; null if unknown. */
export function useStorageEstimate(when) {
  const [estimate, setEstimate] = useState(null);
  useEffect(() => {
    let live = true;
    Promise.resolve(navigator.storage?.estimate?.())
      .then((e) => { if (live && e && typeof e.usage === 'number') setEstimate({ usage: e.usage, quota: e.quota }); })
      .catch(() => {});
    return () => { live = false; };
  }, [when]);
  return estimate;
}
