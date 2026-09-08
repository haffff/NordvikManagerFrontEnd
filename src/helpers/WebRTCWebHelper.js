// REST-over-WebRTC helper.
// Mirrors WebHelper's public API; routes calls through the WebRTC data channel
// instead of direct HTTP. Injected with a transport by WebRTCManager.

import WebHelper from './WebHelper';
import UtilityHelper from './UtilityHelper';

const REQUEST_TIMEOUT_MS = 30000;

// Recursively convert object keys from PascalCase to camelCase.
function _camelizeKeys(obj) {
  if (Array.isArray(obj)) return obj.map(_camelizeKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k.charAt(0).toLowerCase() + k.slice(1),
        _camelizeKeys(v),
      ])
    );
  }
  return obj;
}

// Convert a base64 string (with optional data-URI prefix) to blob or text.
function _base64ToData(b64, mimeType) {
  const stripped = b64.replace(/^data:[^;]+;base64,/, '');
  if (mimeType.startsWith('text') || mimeType.startsWith('application/json')) {
    return atob(stripped);
  }
  const bytes = Uint8Array.from(atob(stripped), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

class WebRTCWebHelper {
  GameId = undefined;

  _transport = null;    // set by WebRTCManager via setTransport()
  _pending = new Map(); // id → { resolve, reject, timeoutHandle }
  _queue = [];          // requests waiting for data channel to open
  _resourceCache = new Map(); // cacheKey (id or key) → Blob

  // Called by WebRTCManager once, passing itself as transport
  setTransport(transport) {
    console.log('[WebRTCWebHelper] setTransport called, queued:', this._queue.length);
    this._transport = transport;
  }

  // Called by WebRTCManager.Close() when a game session ends. Without this, a
  // request still sitting in _queue (channel not open yet) or _pending (sent,
  // awaiting response) at exit time would survive into the next game — queued
  // requests get flushed onto the next session's data channel on its dc.onopen,
  // still tagged with the old game's gameid, and pending ones would just hang
  // until their timeout. Reject everything outstanding and start clean.
  reset() {
    for (const { reject, timeoutHandle } of this._pending.values()) {
      clearTimeout(timeoutHandle);
      reject(new Error('WebRTC transport reset (game session ended)'));
    }
    this._pending.clear();

    for (const { reject, timeoutHandle } of this._queue) {
      clearTimeout(timeoutHandle);
      reject(new Error('WebRTC transport reset (game session ended)'));
    }
    this._queue = [];

    // Deliberately NOT touching GameId here. Game.js sets it on every render
    // (`WebHelper.GameId = gameID`) and MainApp's unmount effect already clears it
    // on logout — but forceReconnect() (Close() → Start(), same tick) and the Retry
    // handler's loadGame() run before Game.js's next render, so clearing it here
    // would send/queue every request made in that window with no gameid until the
    // next render happened to run.
  }

  // Called by WebRTCManager when an api-response arrives on the data channel
  handleApiResponse({ id, status, body }) {
    const entry = this._pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timeoutHandle);
    this._pending.delete(id);
    entry.resolve({ status, body: _camelizeKeys(body) });
  }

  // Called by WebRTCManager when data channel opens — flush queued requests
  flushQueue() {
    const channelReady = this._transport?.isChannelReady() ?? false;
    console.log(`[WebRTCWebHelper] flushQueue: ${this._queue.length} queued, transport=${!!this._transport}, channelReady=${channelReady}`);
    const items = this._queue.splice(0);
    for (const { message, resolve, reject, timeoutHandle } of items) {
      this._pending.set(message.id, { resolve, reject, timeoutHandle });
      const sent = this._transport?.sendRaw(message);
      console.log(`[WebRTCWebHelper] flushed ${message.method} ${message.path}, sent=${sent}`);
    }
  }

  _sendRequest(method, path, body = null) {
    const id = crypto.randomUUID();

    // Separate inline query params from path, then add gameid
    const qIdx = path.indexOf('?');
    const basePath = qIdx >= 0 ? path.slice(0, qIdx) : path;
    const query = {};
    if (qIdx >= 0) {
      for (const [k, v] of new URLSearchParams(path.slice(qIdx + 1)).entries()) {
        query[k] = v;
      }
    }
    if (this.GameId) query.gameid = this.GameId;

    const normalizedPath = (basePath.startsWith('api/') ? basePath : `api/${basePath}`).toLowerCase();
    const message = { type: 'api-request', id, method, path: normalizedPath, query, body };

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error(`WebRTC API timeout: ${method} ${normalizedPath}`));
      }, REQUEST_TIMEOUT_MS);

      if (this._transport?.isChannelReady()) {
        console.log(`[WebRTCWebHelper] send immediate: ${method} ${normalizedPath}`);
        this._pending.set(id, { resolve, reject, timeoutHandle });
        this._transport.sendRaw(message);
      } else {
        console.log(`[WebRTCWebHelper] queued: ${method} ${normalizedPath} (transport=${!!this._transport}, channelReady=${this._transport?.isChannelReady() ?? false})`);
        // Queue until channel opens; transport will call flushQueue()
        this._queue.push({ message, resolve, reject, timeoutHandle });
        // Safety net: channel may have opened between the isChannelReady() check above and
        // this push (race condition where dc.onopen fires before React effects run loadGame).
        if (this._transport?.isChannelReady()) {
          this.flushQueue();
        }
      }
    });
  }

  // ── WebHelper-compatible API ─────────────────────────────────────────────

  getAsync(path) {
    return this._sendRequest('GET', path).then((r) => {
      if (r.status >= 200 && r.status < 300) return r.body;
      console.warn(`[WebRTCWebHelper] getAsync: HTTP ${r.status} for ${path}`);
      return undefined;
    });
  }

  get(path, onok, onerror, onException) {
    this._sendRequest('GET', path)
      .then((r) => {
        if (r.status >= 200 && r.status < 300) { if (onok) onok(r.body); }
        else { if (onerror) onerror(r); }
      })
      .catch((e) => { if (onException) onException(e); else console.error(e); });
  }

  getNoResp(path, onok, onerror, onException) {
    this._sendRequest('GET', path)
      .then((r) => { if (r.status >= 200 && r.status < 300) { if (onok) onok(); } else { if (onerror) onerror(r); } })
      .catch((e) => { if (onException) onException(e); else console.error(e); });
  }

  async getNoRespAsync(path) {
    const result = await this._sendRequest('GET', path);
    // Return a fetch-Response-like object so callers can check .ok / .status
    return { ok: result.status >= 200 && result.status < 300, status: result.status };
  }

  postAsync(path, body) {
    return this._sendRequest('POST', path, body);
  }

  putAsync(path, body) {
    return this._sendRequest('PUT', path, body);
  }

  post(path, body, onok, onerror, onException) {
    this._sendRequest('POST', path, body)
      .then((r) => {
        if (r.status >= 200 && r.status < 300) { if (onok) onok(r.body); }
        else { if (onerror) onerror(r); }
      })
      .catch((e) => { if (onException) onException(e); else console.error(e); });
  }

  deleteAsync(path, body = null) {
    return this._sendRequest('DELETE', path, body).then((r) => r.body);
  }

  // ── Material / resource helpers ──────────────────────────────────────────

  // Static resources are served via HTTP (REST still works); return the HTTP
  // URL directly so <img src> and other consumers work without tunneling.
  getResourceString(id, key, gameId) {
    return WebHelper.getResourceString(id, key, gameId ?? this.GameId);
  }

  // Fetch a material via the data channel. The backend returns
  // { data: base64, mimeType: string }; convert to Blob or text to match
  // what callers of WebHelper.getMaterialAsync expect.
  async getMaterialAsync(id, mimeType, key) {
    const queryParam = id ? `id=${id}` : `key=${key}`;
    const result = await this._sendRequest('GET', `materials/resource?${queryParam}`);
    if (result?.status !== 200 || !result?.body?.data) {
      console.warn(`[WebRTCWebHelper] getMaterialAsync failed for id=${id} key=${key}: status=${result?.status}`, result?.body);
      return undefined;
    }
    const mt = mimeType ?? result.body.mimeType ?? 'application/octet-stream';
    return _base64ToData(result.body.data, mt);
  }

  // Fetch a resource as a Blob, with session-level in-memory caching.
  // Used by the fabric.js image loading override so repeated canvas loads
  // don't re-fetch the same image over the data channel.
  async getResourceBlobAsync(id, key) {
    const cacheKey = id || key;
    if (this._resourceCache.has(cacheKey)) {
      return this._resourceCache.get(cacheKey);
    }
    const blob = await this.getMaterialAsync(id, null, key);
    if (blob instanceof Blob) this._resourceCache.set(cacheKey, blob);
    return blob;
  }

  clearResourceCache() {
    this._resourceCache.clear();
  }

  getMaterial(id, mimeType, onok, onerror, onException) {
    this.getMaterialAsync(id, mimeType)
      .then((data) => {
        if (data !== undefined) { if (onok) onok(data); }
        else { if (onerror) onerror(); }
      })
      .catch((e) => { if (onException) onException(e); else console.error(e); });
  }

  // Upload a material file via the data channel. Converts to base64 first,
  // then sends as a tunneled POST, matching the Materials/AddResource body schema.
  postMaterial(file, onok, onerror, onException) {
    UtilityHelper.ConvertBlobToB64(file).then((b64) => {
      this.post(
        'Materials/AddResource',
        { Name: file.name, Data: b64, MimeType: file.type.toString() },
        onok,
        onerror,
        onException
      );
    }).catch((e) => {
      if (onException) onException(e);
      else console.error(e);
    });
  }
}

const WebRTCWebHelperInstance = new WebRTCWebHelper();
export default WebRTCWebHelperInstance;
