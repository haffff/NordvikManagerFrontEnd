// REST-over-WebRTC helper.
// Mirrors WebHelper's public API; routes calls through the WebRTC data channel
// instead of direct HTTP. Injected with a transport by WebRTCManager.

import WebHelper from './WebHelper';
import ResourceCache from './ResourceCache';
import UtilityHelper from './UtilityHelper';
import addonOpLog, { isAddonOpPath } from './addonOpLog';
import { debugLog } from './debugLog';
import transferStats from './transferStats';

// Roughly how many bytes a request or answer carries: its base64 payload, if it has one.
const _payloadBytes = (body) => {
  const b64 = body?.data ?? body?.Data ?? body?.content ?? body?.Content;
  return typeof b64 === 'string' ? Math.floor(b64.length * 3 / 4) : 0;
};

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
// Resources come in pieces of this size (the most the server sends per part), two at a time.
const PIECE_SIZE = 2 * 1024 * 1024;
const PARALLEL_PIECES = 2;
const CACHED = 'cached', WHOLE = 'whole', FAILED = 'failed';
// An upload gives up after this many parts in a row lost on the way.
const MAX_UPLOAD_MISSES = 5;

// A Blob (or slice) as base64, without the data: prefix.
function _blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function _base64ToBytes(b64) {
  const stripped = b64.replace(/^data:[^;]+;base64,/, '');
  return Uint8Array.from(atob(stripped), (c) => c.charCodeAt(0));
}

// Text types come back as a "binary string" (one char per byte, what atob gives),
// everything else as a Blob — the same whether fetched or from the cache.
function _bytesToData(bytes, mimeType) {
  if (mimeType.startsWith('text') || mimeType.startsWith('application/json')) {
    let text = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return text;
  }
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
    debugLog('[WebRTCWebHelper] setTransport called, queued:', this._queue.length);
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
    if (!entry) {
      addonOpLog(`api-response id=${id} status=${status} arrived for no pending request (timed out or reset already)`);
      return;
    }
    if (entry.trace) addonOpLog(`api-response ${entry.trace} → ${status}`, body);
    clearTimeout(entry.timeoutHandle);
    this._pending.delete(id);
    entry.stat?.done({ status, bytes: Math.max(_payloadBytes(body), entry.sentBytes ?? 0) });
    entry.resolve({ status, body: _camelizeKeys(body) });
  }

  // Called by WebRTCManager while a chunked message comes in. Chunks don't say which
  // response they belong to, so every request waiting for its answer gets the full
  // timeout again: a big response (a whole PDF) is given up on only when it stops coming.
  responseProgress() {
    for (const entry of this._pending.values()) { entry.armTimeout?.(); entry.stat?.firstByte(); }
  }

  // Called by WebRTCManager when data channel opens — flush queued requests
  flushQueue() {
    const channelReady = this._transport?.isChannelReady() ?? false;
    debugLog(`[WebRTCWebHelper] flushQueue: ${this._queue.length} queued, transport=${!!this._transport}, channelReady=${channelReady}`);
    const items = this._queue.splice(0);
    for (const item of items) {
      debugLog(`[WebRTCWebHelper] flushing ${item.message.method} ${item.message.path}`);
      this._dispatch(item);
    }
  }

  // Hands a request to the transport. The response timeout starts once it's all
  // sent: a large upload is fed into the channel as it drains, which can take longer
  // than the timeout on its own.
  _dispatch({ message, resolve, reject, timeoutHandle, onProgress }) {
    clearTimeout(timeoutHandle); // the wait for the channel (if queued) is over
    const id = message.id;
    const trace = message.method !== 'GET' && isAddonOpPath(message.path)
      ? `${message.method} ${message.path} id=${id}` : null;
    if (trace) addonOpLog(`sending ${trace}`);
    const stat = transferStats.start(message.method, message.path);
    this._pending.set(id, { resolve, reject, timeoutHandle: null, trace, stat, sentBytes: _payloadBytes(message.body) });
    let sending;
    try {
      sending = this._transport.sendRaw(message, { onProgress });
    } catch (e) {
      sending = Promise.reject(e);
    }
    Promise.resolve(sending).then(
      () => {
        const entry = this._pending.get(id);
        if (!entry) return; // already answered or reset
        if (trace) addonOpLog(`sent ${trace}, waiting up to ${REQUEST_TIMEOUT_MS / 1000}s for the answer`);
        entry.armTimeout = () => {
          clearTimeout(entry.timeoutHandle);
          entry.timeoutHandle = setTimeout(() => {
            if (trace) addonOpLog(`TIMEOUT ${trace}: no answer from the server`);
            this._pending.delete(id);
            reject(new Error(`WebRTC API timeout: ${message.method} ${message.path}`));
          }, REQUEST_TIMEOUT_MS);
        };
        entry.armTimeout();
      },
      (err) => {
        if (trace) addonOpLog(`send FAILED ${trace}: ${err?.message}`);
        if (this._pending.delete(id)) reject(err);
      }
    );
  }

  _sendRequest(method, path, body = null, { onProgress } = {}) {
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
        // Still waiting for the channel: drop it, so flushQueue never sends a
        // request the caller was already told failed.
        this._queue = this._queue.filter((item) => item.message.id !== id);
        reject(new Error(`WebRTC API timeout: ${method} ${normalizedPath}`));
      }, REQUEST_TIMEOUT_MS);

      if (this._transport?.isChannelReady()) {
        debugLog(`[WebRTCWebHelper] send immediate: ${method} ${normalizedPath}`);
        this._dispatch({ message, resolve, reject, timeoutHandle, onProgress });
      } else {
        debugLog(`[WebRTCWebHelper] queued: ${method} ${normalizedPath} (transport=${!!this._transport}, channelReady=${this._transport?.isChannelReady() ?? false})`);
        if (method !== 'GET' && isAddonOpPath(normalizedPath))
          addonOpLog(`queued ${method} ${normalizedPath} id=${id}: data channel not open yet`);
        // Queue until channel opens; transport will call flushQueue()
        this._queue.push({ message, resolve, reject, timeoutHandle, onProgress });
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

  // onProgress(sentBytes, totalBytes) while the request is being sent.
  post(path, body, onok, onerror, onException, onProgress) {
    this._sendRequest('POST', path, body, { onProgress })
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
  // { data: base64, mimeType, version }; convert to Blob or text to match
  // what callers of WebHelper.getMaterialAsync expect.
  // `thumbnail` requests a small server-generated/cached resize instead of the
  // original file — used for previews so a folder of full-res images doesn't
  // pull every original down just to show a 36px icon.
  // Results are kept in ResourceCache (in the browser, between sessions): a cached
  // resource is requested with its version, and the server answers { notModified }
  // instead of sending it again while that version is current.
  //
  // A file comes in pieces (materials/resourcerange, PIECE_SIZE each, two at a time), so
  // other messages get through while a big one loads, the server never holds the whole file
  // for it, and onProgress(fraction) can follow it. An older server without that route, or a
  // file that changes during the download, gets the whole-file request below instead.
  // raw: { bytes, mimeType } (the server's type) instead of a Blob or string, e.g. for the
  // Card API, which decodes text itself.
  async getMaterialAsync(id, mimeType, key, thumbnail = false, { onProgress, raw = false } = {}) {
    const queryParam = id ? `id=${id}` : `key=${key}`;
    const thumbParam = thumbnail ? '&thumbnail=true' : '';
    const cacheKey = `${this.GameId}:${thumbnail ? 't:' : ''}${id || key}`;
    const cached = await ResourceCache.get(cacheKey);
    const versionParam = cached ? `&ifVersion=${encodeURIComponent(cached.version)}` : '';
    const out = (bytes, serverMimeType) => (raw ? { bytes, mimeType: serverMimeType } : _bytesToData(bytes, mimeType ?? serverMimeType));

    if (!thumbnail) {
      const pieces = await this._getInPieces(queryParam, cached, onProgress);
      if (pieces === FAILED) {
        console.warn(`[WebRTCWebHelper] getMaterialAsync failed for id=${id} key=${key}`);
        return undefined;
      }
      if (pieces === CACHED)
        return out(new Uint8Array(cached.data), cached.mimeType ?? 'application/octet-stream');
      if (pieces !== WHOLE) {
        const serverMimeType = pieces.mimeType ?? 'application/octet-stream';
        // Not awaited: storing mustn't delay the caller.
        if (pieces.version) ResourceCache.put(cacheKey, { data: pieces.bytes.buffer, mimeType: serverMimeType, version: pieces.version });
        return out(pieces.bytes, serverMimeType);
      }
    }

    const result = await this._sendRequest('GET', `materials/resource?${queryParam}${thumbParam}${versionParam}`);
    if (result?.status === 200 && result.body?.notModified && cached) {
      return out(new Uint8Array(cached.data), cached.mimeType ?? 'application/octet-stream');
    }
    if (result?.status !== 200 || !result?.body?.data) {
      console.warn(`[WebRTCWebHelper] getMaterialAsync failed for id=${id} key=${key}: status=${result?.status}`, result?.body);
      return undefined;
    }
    const serverMimeType = result.body.mimeType ?? 'application/octet-stream';
    const bytes = _base64ToBytes(result.body.data);
    if (result.body.version) {
      // Not awaited: storing mustn't delay the caller.
      ResourceCache.put(cacheKey, { data: bytes.buffer, mimeType: serverMimeType, version: result.body.version });
    }
    return out(bytes, serverMimeType);
  }

  // The pieces of a resource, assembled: { bytes, mimeType, version }, or CACHED (the cached
  // copy is current), WHOLE (ask with the whole-file request instead) or FAILED.
  async _getInPieces(queryParam, cached, onProgress) {
    const pieceSize = this.pieceSize ?? PIECE_SIZE;
    const path = (start) => `materials/resourcerange?${queryParam}&start=${start}&length=${pieceSize}`;
    const first = await this._sendRequest('GET', path(0) + (cached ? `&ifVersion=${encodeURIComponent(cached.version)}` : ''));
    if (first?.status === 404) return WHOLE; // an older server (or no such file: the whole-file request says so)
    if (first?.status !== 200) return FAILED;
    if (first.body?.notModified && cached) return CACHED;
    if (typeof first.body?.data !== 'string') return FAILED;

    const { total, version, mimeType } = first.body;
    const head = _base64ToBytes(first.body.data);
    if (head.length >= total) return { bytes: head, mimeType, version };
    const bytes = new Uint8Array(total);
    bytes.set(head, 0);
    let received = head.length;
    onProgress?.(received / total);

    const starts = [];
    for (let start = pieceSize; start < total; start += pieceSize) starts.push(start);
    let outcome = null; // WHOLE or FAILED, once something goes wrong
    const fetchPiece = async (start) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        let result;
        try { result = await this._sendRequest('GET', path(start)); } catch { continue; }
        if (result?.status !== 200 || typeof result.body?.data !== 'string') continue;
        if (result.body.version !== version) return WHOLE; // changed meanwhile
        return _base64ToBytes(result.body.data);
      }
      return FAILED;
    };
    const worker = async () => {
      while (starts.length && !outcome) {
        const start = starts.shift();
        const piece = await fetchPiece(start);
        if (piece === WHOLE || piece === FAILED) { outcome ??= piece; return; }
        bytes.set(piece, start);
        received += piece.length;
        onProgress?.(received / total);
      }
    };
    await Promise.all(Array.from({ length: PARALLEL_PIECES }, worker));
    return outcome ?? { bytes, mimeType, version };
  }

  // Fetch a resource as a Blob, with session-level in-memory caching.
  // Used by the fabric.js image loading override so repeated canvas loads
  // don't re-fetch the same image over the data channel. Thumbnails are cached
  // under their own key so a full-res fetch and a thumbnail fetch of the same
  // resource never shadow each other.
  async getResourceBlobAsync(id, key, thumbnail = false) {
    const cacheKey = (thumbnail ? 'thumb:' : '') + (id || key);
    if (this._resourceCache.has(cacheKey)) {
      return this._resourceCache.get(cacheKey);
    }
    const blob = await this.getMaterialAsync(id, null, key, thumbnail);
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
  // onProgress(fraction 0..1) follows the upload.
  // parentFolder: the Materials folder (tree entry) it goes into; the top level when null.
  // A file bigger than one piece goes up in parts (uploadInPieces); an older server without
  // that gets the single request below.
  postMaterial(file, onok, onerror, onException, onProgress, parentFolder = null) {
    if (file?.size > (this.pieceSize ?? PIECE_SIZE)) {
      this.uploadInPieces(file, { name: file.name, mimeType: file.type?.toString(), parentFolder }, { onProgress })
        .then((r) => {
          if (r === null) return this._postMaterialWhole(file, onok, onerror, onException, onProgress, parentFolder);
          if (r.status >= 200 && r.status < 300) { if (onok) onok(r.body); }
          else if (onerror) onerror(r);
        })
        .catch((e) => { if (onException) onException(e); else console.error(e); });
      return;
    }
    this._postMaterialWhole(file, onok, onerror, onException, onProgress, parentFolder);
  }

  /**
   * Uploads a Blob in parts of pieceSize (materials/UploadStart, UploadPart, UploadFinish):
   * no huge request, onProgress(fraction) as parts arrive, and a part lost on the way is
   * resumed from what the server has (UploadStatus). meta: { name, mimeType, key, parentFolder,
   * storageKind } (with a key: made like CreateResource; without: like a Materials upload).
   * Resolves to the finishing answer { status, body }, the refusal of the start, or null
   * when the server has no such routes (send it in one piece then).
   */
  // One upload at a time: two big uploads at once kept the data channel full without a pause
  // and the GM backend's WebRTC stack dropped the connection (seen with two 20 MB PDFs; one at
  // a time was fine). The others wait their turn, also when one before them fails.
  uploadInPieces(blob, meta, options) {
    const run = () => this._uploadInPiecesNow(blob, meta, options);
    const result = (this._uploadQueue ?? Promise.resolve()).then(run, run);
    this._uploadQueue = result.catch(() => {});
    return result;
  }

  async _uploadInPiecesNow(blob, { name, mimeType, key = null, parentFolder = null, storageKind = 0 }, { onProgress } = {}) {
    const pieceSize = this.pieceSize ?? PIECE_SIZE;
    const size = blob.size;
    const start = await this._sendRequest('POST', 'materials/uploadstart', {
      Name: name, MimeType: mimeType, Key: key, ParentFolder: parentFolder, StorageKind: storageKind, Size: size,
    });
    if (start?.status === 404) return null;
    if (start?.status !== 200 || !start.body?.uploadId) return start;
    const uploadId = start.body.uploadId;

    let offset = 0;
    let misses = 0;
    while (offset < size) {
      const data = await _blobToBase64(blob.slice(offset, offset + pieceSize));
      let r = null;
      try { r = await this._sendRequest('POST', 'materials/uploadpart', { UploadId: uploadId, Offset: offset, Data: data }); } catch { r = null; }
      if (r?.status === 200 && typeof r.body?.received === 'number') {
        offset = r.body.received;
        misses = 0;
        onProgress?.(offset / size);
        continue;
      }
      if (r?.status === 409 && typeof r.body?.received === 'number') { offset = r.body.received; continue; }
      if (r?.status === 404 || ++misses > MAX_UPLOAD_MISSES) return r ?? { status: 0, body: { error: 'The upload was lost.' } };
      // lost on the way (or the connection dropped): wait a little, then ask where it is
      await new Promise((res) => setTimeout(res, (this.retryDelayMs ?? 1000) * misses));
      try {
        const status = await this._sendRequest('GET', `materials/uploadstatus?uploadId=${uploadId}`);
        if (status?.status === 200 && typeof status.body?.received === 'number') offset = status.body.received;
      } catch { /* asked again on the next miss */ }
    }
    return this._sendRequest('POST', 'materials/uploadfinish', { UploadId: uploadId });
  }

  _postMaterialWhole(file, onok, onerror, onException, onProgress, parentFolder) {
    UtilityHelper.ConvertBlobToB64(file).then((b64) => {
      this.post(
        'Materials/AddResource',
        { Name: file.name, Data: b64, MimeType: file.type.toString(), ParentFolder: parentFolder },
        onok,
        onerror,
        onException,
        onProgress && ((sent, total) => onProgress(total ? sent / total : 1))
      );
    }).catch((e) => {
      if (onException) onException(e);
      else console.error(e);
    });
  }
}

const WebRTCWebHelperInstance = new WebRTCWebHelper();
export default WebRTCWebHelperInstance;
