// Which app this is: the GM's (served by the GM backend), the player client, or the
// demo (mocked data, either view). The build sets REACT_APP_MODE; the demo switches
// between the GM and the player view at runtime.

let demoRole = 'gm';

export const isDemo = () => process.env.REACT_APP_MODE === 'demo';

/**
 * The host build: the GM app with its backend (the browser host, NordvikManager.Wasm.Host) running
 * in this tab. It's the GM's app, not the player client (isPlayerMode() is false); the tab is the
 * game's server, so it must not navigate away while a session runs.
 */
export const isHostMode = () => process.env.REACT_APP_MODE === 'host';

export const getDemoRole = () => demoRole;

export const setDemoRole = (role) => {
  demoRole = role === 'player' ? 'player' : 'gm';
};

/** True in the player client, and in the demo's player view. */
export const isPlayerMode = () =>
  process.env.REACT_APP_MODE === 'player' || (isDemo() && demoRole === 'player');
