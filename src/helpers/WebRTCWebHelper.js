// REST-over-WebRTC helper.
// Mirrors WebHelper's public API; routes calls through the WebRTC data channel
// instead of direct HTTP. Injected with a transport by WebRTCManager.

const REQUEST_TIMEOUT_MS = 30000;

class WebRTCWebHelper {
  GameId = undefined;

  _transport = null;    // set by WebRTCManager via setTransport()
  _pending = new Map(); // requestId → { resolve, reject, timeoutHandle }
  _queue = [];          // requests waiting for data channel to open

  // Called by WebRTCManager once, passing itself as transport
  setTransport(transport) {
    console.log('[WebRTCWebHelper] setTransport called, queued:', this._queue.length);
    this._transport = transport;
  }

  // Called by WebRTCManager when an api-response arrives on the data channel
  handleApiResponse({ requestId, status, body }) {
    const entry = this._pending.get(requestId);
    if (!entry) return;
    clearTimeout(entry.timeoutHandle);
    this._pending.delete(requestId);
    entry.resolve({ status, body });
  }

  // Called by WebRTCManager when data channel opens — flush queued requests
  flushQueue() {
    const channelReady = this._transport?.isChannelReady() ?? false;
    console.log(`[WebRTCWebHelper] flushQueue: ${this._queue.length} queued, transport=${!!this._transport}, channelReady=${channelReady}`);
    const items = this._queue.splice(0);
    for (const { message, resolve, reject, timeoutHandle } of items) {
      this._pending.set(message.requestId, { resolve, reject, timeoutHandle });
      const sent = this._transport?.sendRaw(message);
      console.log(`[WebRTCWebHelper] flushed ${message.method} ${message.path}, sent=${sent}`);
    }
  }

  addGameId(path, customGameId) {
    const id = customGameId ?? this.GameId;
    if (!id) return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}gameid=${id}`;
  }

  _sendRequest(method, path, body = null) {
    const requestId = crypto.randomUUID();
    const fullPath = this.addGameId(path);
    const message = { type: 'api-request', requestId, method, path: fullPath, body };

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this._pending.delete(requestId);
        reject(new Error(`WebRTC API timeout: ${method} ${fullPath}`));
      }, REQUEST_TIMEOUT_MS);

      if (this._transport?.isChannelReady()) {
        console.log(`[WebRTCWebHelper] send immediate: ${method} ${fullPath}`);
        this._pending.set(requestId, { resolve, reject, timeoutHandle });
        this._transport.sendRaw(message);
      } else {
        console.log(`[WebRTCWebHelper] queued: ${method} ${fullPath} (transport=${!!this._transport}, channelReady=${this._transport?.isChannelReady() ?? false})`);
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
    return this._sendRequest('GET', path).then((r) => r.body);
  }

  getNoResp(path, onok, onerror, onException) {
    this._sendRequest('GET', path)
      .then((r) => { if (r.status >= 200 && r.status < 300) { if (onok) onok(); } else { if (onerror) onerror(r); } })
      .catch((e) => { if (onException) onException(e); else console.error(e); });
  }

  postAsync(path, body) {
    return this._sendRequest('POST', path, body);
  }

  post(path, body, onok, onerror, onException) {
    this._sendRequest('POST', path, body)
      .then((r) => {
        if (r.status >= 200 && r.status < 300) { if (onok) onok(r.body); }
        else { if (onerror) onerror(r); }
      })
      .catch((e) => { if (onException) onException(e); else console.error(e); });
  }

  deleteAsync(path) {
    return this._sendRequest('DELETE', path).then((r) => r.body);
  }

  getResourceString(id, key, gameId) {
    const base = `Materials/Resource`;
    if (id) return this.addGameId(`${base}?id=${id}`, gameId);
    if (key) return this.addGameId(`${base}?key=${key}`, gameId);
    return this.addGameId(`${base}?key=emptyImage`, gameId);
  }

  getMaterialAsync(id) {
    return this.getAsync(`Materials/Resource?id=${id}`);
  }
}

const WebRTCWebHelperInstance = new WebRTCWebHelper();
export default WebRTCWebHelperInstance;
