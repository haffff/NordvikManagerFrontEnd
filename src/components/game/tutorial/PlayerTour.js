import React from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import '../../../stylesheets/tour.css';
import ClientMediator from '../../../ClientMediator';
import { shouldStartTour, startPlayerTour } from './tourSteps';

const safeLocalStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

/**
 * Shows the player tour once, the first time a player's game finishes loading, and
 * whenever "Show tutorial" (ClientMediator Tutorial.Start) asks for it. Renders nothing.
 *
 * `ready` turns true when the game and its layout are loaded; `delayMs` gives the
 * docked panels a moment to lay out before the tour looks for them.
 */
export const PlayerTour = ({ ready, isGM, storage = safeLocalStorage(), driverFactory = driver, delayMs = 800 }) => {
  const startedRef = React.useRef(false);
  const settingsRef = React.useRef({ storage, driverFactory });
  settingsRef.current = { storage, driverFactory };

  const start = React.useCallback(() => {
    const { storage: s, driverFactory: factory } = settingsRef.current;
    return startPlayerTour({ storage: s, driverFactory: factory });
  }, []);

  React.useEffect(() => {
    if (!ready || startedRef.current || !shouldStartTour({ isGM, storage })) return undefined;
    const timer = setTimeout(() => {
      startedRef.current = true;
      start();
    }, delayMs);
    return () => clearTimeout(timer);
  }, [ready, isGM, storage, delayMs, start]);

  React.useEffect(() => {
    const client = { panel: 'Tutorial', id: 'Tutorial', Start: () => { start(); return true; } };
    ClientMediator.register(client);
    return () => ClientMediator.unregister('Tutorial');
  }, [start]);

  return null;
};

export default PlayerTour;
