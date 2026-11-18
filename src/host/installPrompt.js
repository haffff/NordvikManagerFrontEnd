// "Install as app" for the host build. Chrome and Edge offer it with a beforeinstallprompt event
// (when the page is installable: its manifest); keeping that event lets the host banner show its
// own button. An installed app is what makes Chrome likeliest to grant persistent storage.
import { useEffect, useState } from 'react';

/** Watches `target` (the window) for the browser's offer to install. */
export function createInstallPrompt(target) {
  let offer = null;
  let installed = false;
  const listeners = new Set();
  const changed = () => listeners.forEach((fn) => fn());

  target.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // our button, not the browser's mini-infobar
    offer = event;
    changed();
  });
  target.addEventListener('appinstalled', () => {
    offer = null;
    installed = true;
    changed();
  });

  return {
    canInstall: () => !!offer,
    installed: () => installed,
    /** Shows the browser's install dialog; true when the user installed. An offer works once. */
    async install() {
      const event = offer;
      if (!event) return false;
      offer = null;
      changed();
      await event.prompt();
      const { outcome } = await event.userChoice;
      return outcome === 'accepted';
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

// From as early as this module loads: the offer can come soon after the page does.
const shared = typeof window !== 'undefined' ? createInstallPrompt(window) : null;

/** { canInstall, install } for this page. */
export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(() => shared?.canInstall() ?? false);
  useEffect(() => shared?.subscribe(() => setCanInstall(shared.canInstall())), []);
  return { canInstall, install: () => shared?.install() ?? Promise.resolve(false) };
}
