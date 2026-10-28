// Turns a recording of a real game session into demo fixtures.
//
// A recording (see recorder.js) is the data channel in order: { t, dir, msg }, where
// dir is 'out' (client → GM backend: api-requests and commands) or 'in' (answers and
// broadcasts). A fixture keeps:
//   requests: the first answer to each REST request (later ones reflect changes made
//             during the recording), keyed by requestKey()
//   after:    the broadcasts that followed each command or request, within
//             AFTER_WINDOW_MS and before the client's next message, keyed by
//             commandKey() / requestKey(). The demo replays them, e.g. what an
//             action posted to chat.

export const FIXTURE_VERSION = 1;
export const AFTER_WINDOW_MS = 2000;

/** "GET api/map/get?mapid=m1": method, path and query, without the game id, lowercased and sorted. */
export function requestKey(method, path, query = {}) {
  const params = Object.entries(query ?? {})
    .map(([k, v]) => [k.toLowerCase(), String(v)])
    .filter(([k]) => k !== 'gameid')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `${String(method).toUpperCase()} ${String(path).toLowerCase()}${params ? `?${params}` : ''}`;
}

/** Actions by name, chat commands by their first word, everything else by command. */
export function commandKey(cmd) {
  if (cmd?.command === 'execute_action') {
    const action = cmd.data?.action ?? cmd.data?.Action;
    return `execute_action ${action}`;
  }
  if (cmd?.command === 'chat_push' && typeof cmd.data === 'string' && cmd.data.startsWith('/')) {
    return `chat_push ${cmd.data.split(' ')[0].toLowerCase()}`;
  }
  return cmd?.command;
}

const SECRET_KEY = /^(password|passwd|secret|.*_secret|.*Secret|access_?token|refresh_?token|jwt.*|cookie|authorization|api_?key|e?mail|emailAddress)$/i;

/** Paths of fields that look like credentials or personal data (non-empty strings under such keys). */
export function findSecrets(value, path = '') {
  const found = [];
  if (Array.isArray(value)) {
    value.forEach((item, i) => found.push(...findSecrets(item, `${path}[${i}]`)));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const p = path ? `${path}.${k}` : k;
      if (SECRET_KEY.test(k) && typeof v === 'string' && v !== '') found.push(p);
      else found.push(...findSecrets(v, p));
    }
  }
  return found;
}

const isRequest = (msg) => msg?.type === 'api-request';
const isResponse = (msg) => msg?.type === 'api-response';

export function buildFixture(transcript, role) {
  const requests = {};
  const after = {};
  const pending = new Map(); // request id → key

  transcript.forEach((entry, index) => {
    const { dir, msg, t } = entry;

    if (dir === 'out') {
      const key = isRequest(msg) ? requestKey(msg.method, msg.path, msg.query) : commandKey(msg);
      if (isRequest(msg)) pending.set(msg.id, { key, method: String(msg.method).toUpperCase() });
      if (!key || after[key]) return;

      // The broadcasts that answer it: until the client's next message, within the window.
      const replies = [];
      for (let j = index + 1; j < transcript.length; j++) {
        const next = transcript[j];
        if (next.dir === 'out' || next.t - t > AFTER_WINDOW_MS) break;
        if (!isResponse(next.msg)) replies.push(next.msg);
      }
      if (replies.length) after[key] = replies;
      return;
    }

    if (isResponse(msg) && pending.has(msg.id)) {
      const { key, method } = pending.get(msg.id);
      pending.delete(msg.id);
      if (method === 'GET' && requests[key]) return; // keep the initial state
      requests[key] = { status: msg.status, body: msg.body ?? null };
    }
  });

  const fixture = { version: FIXTURE_VERSION, role, requests, after };
  const secrets = findSecrets(fixture);
  if (secrets.length) {
    throw new Error(`The recording contains credentials, refusing to build a fixture: ${secrets.join(', ')}`);
  }
  return fixture;
}
