// Full screen for the whole page: on a phone it hides the address bar and the system bars,
// which otherwise stay because the game view never scrolls. iPhone Safari allows it only for
// videos (fullscreenEnabled is false there); older iPad Safari has only the webkit names.

export function canFullscreen(doc = document) {
  return Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
}

export function isFullscreen(doc = document) {
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

// Must run inside a tap: browsers refuse full screen without a user gesture.
export async function toggleFullscreen(doc = document) {
  try {
    if (isFullscreen(doc)) {
      if (doc.exitFullscreen) await doc.exitFullscreen();
      else doc.webkitExitFullscreen?.();
      return;
    }
    const root = doc.documentElement;
    if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: "hide" });
    else root.webkitRequestFullscreen?.();
  } catch {
    // Refused (no gesture, a permissions policy): the page just stays as it is.
  }
}
