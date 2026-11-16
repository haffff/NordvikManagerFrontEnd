// What a GM is told the first time addon code is blocked from reaching somewhere
// (entries of helpers/addonNetworkLog.js). Players see nothing: their own cards' blocks
// are logged and written to the console.
import { toaster } from '../components/ui/toaster';
import ClientMediator from '../ClientMediator';
import { recordBlocked, subscribeBlocked } from './addonNetworkLog';

const hostOf = (origin) => {
  try {
    return new URL(origin).host || origin;
  } catch {
    return String(origin ?? 'an outside address');
  }
};

const ACTION_REASONS = {
  'no-outside-connections': (host) =>
    `It needs ${host}, which the browser version can't reach. Use the local server for this addon.`,
  'browser-refused': (host) =>
    `${host} refuses requests from a browser, or didn't answer. The local server can reach it.`,
  'undeclared-host': (host) =>
    `It tried to reach ${host}, which the addon doesn't list among the hosts it connects to.`,
  'blocked-host': (host) =>
    `It tried to reach ${host}, a private or local address the server doesn't allow requests to.`,
  'network-error': (host) => `It couldn't reach ${host}.`,
};

/**
 * The notice for a blocked attempt: { title, description }.
 * @param entry     an addonNetworkLog entry
 * @param hostInfo  the game's api/Host/Info, when known (the browser version's hosts are fixed)
 */
export function describeBlocked(entry, hostInfo = null) {
  const host = hostOf(entry.origin);
  if (entry.source === 'action') {
    const who = [entry.addon, entry.action].filter(Boolean).join(' › ') || 'An action';
    const why = ACTION_REASONS[entry.reason] ?? ((h) => `It tried to reach ${h} and was refused.`);
    return { title: `${who} was blocked`, description: why(host) };
  }

  const card = entry.card ? `Card "${entry.card}"` : 'A card';
  const title = `${entry.addon ?? card} was blocked`;
  const subject = entry.addon ? (entry.card ? `Its card "${entry.card}"` : 'Its card') : 'It';
  const where = hostInfo?.kind === 'browser'
    ? 'The browser version only allows its fixed hosts.'
    : 'If you trust it, add it in Application Settings › Server › Card sandbox.';
  return {
    title,
    description: `${subject} tried to reach ${host}, which isn't one of this game's allowed hosts. ${where}`,
  };
}

/**
 * Shows GMs a warning for each new blocked attempt; `getHostInfo()` gives the game's host
 * info (or null). Returns the stop function.
 */
export function startBlockedNotices(getHostInfo = () => null) {
  return subscribeBlocked((entry) => {
    const notice = describeBlocked(entry, getHostInfo());
    if (!ClientMediator.sendCommand('Game', 'GetIsGM')) {
      console.warn(`${notice.title}: ${notice.description}`);
      return;
    }
    toaster.create({ type: 'warning', duration: 10000, ...notice });
  });
}

/** The GM backend's command for a refused action request (WebSocketCommandNames.AddonNetworkNotice). */
export const ADDON_NETWORK_NOTICE = 'addon_network_notice';

/**
 * Logs the backend's addon_network_notice (sent to GMs only) as an action entry. True when
 * it was that command (whether or not the entry was new).
 */
export function recordServerNotice(message) {
  if (message?.command !== ADDON_NETWORK_NOTICE) return false;
  const d = message.data ?? {};
  const text = (v) => (typeof v === 'string' && v ? v : null);
  recordBlocked({
    source: 'action',
    addon: text(d.addon),
    action: text(d.action),
    actionId: text(d.actionId),
    origin: text(d.origin),
    reason: text(d.reason),
  });
  return true;
}
