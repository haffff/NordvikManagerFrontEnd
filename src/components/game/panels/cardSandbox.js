/**
 * cardSandbox.js
 *
 * Exports the CardAPI bridge <script> block injected into every card's HTML
 * before it is loaded into the sandboxed iframe.
 *
 * Security model
 * ──────────────
 * • The main resource is ALWAYS a text/html file supplied by the card author.
 * • It runs inside a cross-origin iframe: the app's sandbox page
 *   (public/sandbox.html, sandbox="allow-scripts"), which writes the card HTML
 *   into itself.
 * • The iframe has NO allow-same-origin → it has a null origin and cannot
 *   access the parent page's cookies, localStorage, or DOM at all.
 * • The iframe boundary IS the isolation boundary. The card owns the whole
 *   document (sandbox.html writes the card HTML over itself).
 * • CSS from additional resources is injected as normal <link> tags in <head>.
 *   Because the iframe is cross-origin, those styles never affect the parent.
 * • The only communication channel is postMessage (structured-clone; no
 *   function refs can cross the boundary).
 * • Every parent → sandbox message carries a per-frame nonce (the sandbox page's
 *   URL fragment, built into this script). Another card's frame can't read that
 *   URL, so it can't post this card fake results.
 *
 * postMessage protocol (parent → sandbox)
 * ─────────────────────────────────────────
 *   { type: "INIT",           cardId, additionalArguments }
 *   { type: "CMD_RESULT",     reqId, result, error? }
 *   { type: "PROPERTY_EVENT", eventType, name, propData, global?, parentId? }
 *   { type: "WS_EVENT",       command, data }
 *   { type: "APP_STYLES",     base, theme }
 *   { type: "MEDIATOR_CALL",  reqId, name, command, data }  (a call to a panel the card registered)
 *
 * postMessage protocol (sandbox → parent)
 * ─────────────────────────────────────────
 *   { type: "SANDBOX_READY" }
 *   { type: "CMD",     reqId, panel, command, data }
 *       panel "__mediator__": ClientMediator call (command = panel, data = { command, data })
 *       panel "__register__" / "__unregister__": addon panel (command = name, data = { commands })
 *   { type: "MEDIATOR_RESULT", reqId, result, error? }
 *   { type: "WS_SEND", command, data }
 *   { type: "CLOSE_PANEL" }
 */

import { validOrigins } from "../../../helpers/sandboxOrigins";
import { ALLOWED_WS_COMMANDS } from "../../../CardAPI";

// The card's own CSP, from the GM's host list (helpers/sandboxOrigins.js). It goes first
// in <head>, before the card's styles and scripts, and only tightens the sandbox page's
// header policy: on a player's client that header comes from the Central Server and
// allows any https: host, so this is what holds card code to the GM's list.
//
// The card is parsed (DOMParser runs no scripts) rather than searched for "<head>", so
// the policy lands in the head the browser will actually build — not inside a comment
// or a script string, and before a script that comes ahead of a late <head> tag.
export function withCardCsp(html, origins) {
  const allow = validOrigins(origins).map((o) => " " + o).join("");
  const doc = new DOMParser().parseFromString(html, "text/html");
  const meta = doc.createElement("meta");
  meta.setAttribute("http-equiv", "Content-Security-Policy");
  meta.setAttribute(
    "content",
    `connect-src 'self'${allow}; img-src 'self' data: blob:${allow}; ` +
      `style-src 'self' 'unsafe-inline' data:${allow}; font-src 'self' data:${allow}`
  );
  doc.head.prepend(meta);
  // Without a doctype the card renders in quirks mode, as it would on its own.
  return (doc.doctype ? "<!DOCTYPE html>" : "") + doc.documentElement.outerHTML;
}

const NONCE_PLACEHOLDER = '__NM_SANDBOX_NONCE__';
const WS_COMMANDS_PLACEHOLDER = '__NM_WS_COMMANDS__';

/**
 * The CardAPI bootstrap <script> block for a frame with this nonce.
 * Injected into the card's HTML just before </body>.
 */
export const sandboxBridgeScript = (nonce) =>
  BRIDGE_TEMPLATE.replace(NONCE_PLACEHOLDER, JSON.stringify(String(nonce)))
    .replace(WS_COMMANDS_PLACEHOLDER, JSON.stringify(Object.keys(ALLOWED_WS_COMMANDS)));

const BRIDGE_TEMPLATE = `<script>
(function () {
  'use strict';

  // Messages from the host carry this; anything else is ignored.
  const _nonce = ${NONCE_PLACEHOLDER};

  // Server commands a card may send (CardAPI.js ALLOWED_WS_COMMANDS), nothing else.
  const _wsCommands = ${WS_COMMANDS_PLACEHOLDER};
  // A call the app hasn't answered by then rejects (e.g. the panel closed meanwhile).
  // Resources get longer: uploads go over the paced game connection.
  const RPC_TIMEOUT_MS = 30000;
  const RESOURCES_TIMEOUT_MS = 300000;

  // ── RPC state ─────────────────────────────────────────────────────────────
  let _reqCounter = 0;
  const _pending = {};                  // reqId → { resolve, reject }
  const _propSubscriptions = {};        // name → callback[]
  const _globalPropSubscriptions = {};  // "parentId:name" → callback[]
  const _wsSubscriptions   = [];        // callback[]
  const _registrations     = {};        // addon panel name → { command: handler }

  // Mutable identity fields — written once on INIT
  let _cardId              = null;
  let _additionalArguments = null;

  // onProgress: the call's RESOURCE_PROGRESS messages (an upload); each one also restarts
  // the timeout, so a big upload that keeps going isn't given up on.
  function _rpc(panel, command, data, onProgress) {
    return new Promise((resolve, reject) => {
      const reqId = 'r' + (++_reqCounter);
      const wait = panel === 'Resources' ? RESOURCES_TIMEOUT_MS : RPC_TIMEOUT_MS;
      const giveUp = () => {
        delete _pending[reqId];
        reject(new Error('CardAPI: no answer from the app for ' + panel + '.' + command));
      };
      let timer = setTimeout(giveUp, wait);
      _pending[reqId] = {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject:  (e) => { clearTimeout(timer); reject(e); },
        progress: (fraction) => {
          clearTimeout(timer);
          timer = setTimeout(giveUp, wait);
          if (onProgress) { try { onProgress(fraction); } catch (e) { console.error('CardAPI upload progress callback error', e); } }
        },
      };
      parent.postMessage({ type: 'CMD', reqId, panel, command, data }, '*');
    });
  }

  // Resources.Open's file handle: card code reads any bytes, the whole file or its text; the
  // bytes come in whole pieces (each asked for once; the app caches them between sessions).
  const FILE_PIECE = 256 * 1024;
  function _fileHandle(meta) {
    const pieces = new Map();
    const piece = (index) => {
      if (!pieces.has(index)) {
        const start = index * FILE_PIECE;
        const length = Math.min(FILE_PIECE, meta.size - start);
        const loading = _rpc('Resources', 'ReadRange', { ref: meta.ref, start, length }).then((part) => {
          if (!part || !part.bytes || part.bytes.length < length) throw new Error('CardAPI: bytes ' + start + '-' + (start + length) + ' of the file could not be read');
          return new Uint8Array(part.bytes);
        });
        loading.catch(() => pieces.delete(index));
        pieces.set(index, loading);
      }
      return pieces.get(index);
    };
    let whole = null;
    const handle = {
      size: meta.size,
      mimeType: meta.mimeType,
      version: meta.version,
      /** The bytes from start up to (not including) end, as a Uint8Array. */
      read: async (start, end) => {
        const from = Math.max(0, start || 0);
        const to = Math.min(meta.size, end === undefined ? meta.size : end);
        if (to <= from) return new Uint8Array(0);
        const first = Math.floor(from / FILE_PIECE);
        const last = Math.floor((to - 1) / FILE_PIECE);
        const parts = [];
        for (let i = first; i <= last; i++) parts.push(piece(i));
        const loaded = await Promise.all(parts);
        const out = new Uint8Array(to - from);
        let offset = 0;
        loaded.forEach((bytes, i) => {
          const pieceStart = (first + i) * FILE_PIECE;
          const a = Math.max(from, pieceStart) - pieceStart;
          const b = Math.min(to, pieceStart + bytes.length) - pieceStart;
          out.set(bytes.subarray(a, b), offset);
          offset += b - a;
        });
        return out;
      },
      /** The whole file as a Blob of its type. */
      blob: async () => {
        if (!whole) {
          whole = _rpc('Resources', 'ReadWhole', { ref: meta.ref }).then((data) => {
            if (!data) throw new Error('CardAPI: the file could not be read');
            return new Blob([data], { type: meta.mimeType || 'application/octet-stream' });
          });
          whole.catch(() => { whole = null; });
        }
        return whole;
      },
      text: async () => new TextDecoder().decode(await new Response(await handle.blob()).arrayBuffer()),
      json: async () => JSON.parse(await handle.text()),
      /** A blob: URL an <img>, <audio> or <video> in the card can use (the whole file). */
      mediaUrl: async () => URL.createObjectURL(await handle.blob()),
    };
    return Object.freeze(handle);
  }

  function _sendToServer(command, data) {
    const allowed = typeof command === 'string' && _wsCommands.includes(command);
    if (!allowed) throw new Error('CardAPI: cards may not send "' + command + '" to the server');
    parent.postMessage({ type: 'WS_SEND', command, data }, '*');
  }

  // ── CardAPI surface ────────────────────────────────────────────────────────
  const CardAPI = {
    get cardId()              { return _cardId; },
    get additionalArguments() { return _additionalArguments; },

    Properties: {
      Get:      (name)      => _rpc('Properties', 'Get',      { name }),
      GetMany:  (names)     => _rpc('Properties', 'GetMany',  { names }),
      Set:      (name, val) => _rpc('Properties', 'Set',      { name, value: val }),
      SetMany:  (props)     => _rpc('Properties', 'SetMany',  { properties: props }),
      Init:     (name, val) => _rpc('Properties', 'Init',     { name, value: val }),
      InitMany: (props)     => _rpc('Properties', 'InitMany', { properties: props }),
      Remove:   (name)      => _rpc('Properties', 'Remove',   { name }),
      // Every property of this card in one call (the host answers from the
      // cache it warms when the card opens) — CardPanel.js already routed
      // it; the bridge just never exposed it, so addons fell back to one
      // request per property.
      GetProperties: ()     => _rpc('Properties', 'GetProperties', {}),

      Subscribe: (name, cb) => {
        if (!_propSubscriptions[name]) _propSubscriptions[name] = [];
        _propSubscriptions[name].push(cb);
      },
      Unsubscribe: (name, cb) => {
        const arr = _propSubscriptions[name];
        if (!arr) return;        const i = arr.indexOf(cb);
        if (i !== -1) arr.splice(i, 1);
      },

      /**
       * Repeating-row list data for a single property — see
       * src/CardAPI.js's Properties.List for the full contract (stable
       * per-row ids, Init(name, "[]") required first). Add's itemId is
       * optional — omit it to let the server generate one.
       */
      List: Object.freeze({
        Add:     (name, fields, itemId)   => _rpc('Properties', 'ListAdd',     { name, fields, itemId }),
        Remove:  (name, itemId)           => _rpc('Properties', 'ListRemove',  { name, itemId }),
        Update:  (name, itemId, fields)   => _rpc('Properties', 'ListUpdate',  { name, itemId, fields }),
        Reorder: (name, orderedItemIds)   => _rpc('Properties', 'ListReorder', { name, orderedItemIds }),
      }),

      /** Access propertiesof any entity — parentId supplied explicitly. */
      Global: Object.freeze({
        Get:         (parentId, name)        => _rpc('Properties', 'Get',         { name, parentId, global: true }),
        GetMany:     (parentId, names)       => _rpc('Properties', 'GetMany',     { names, parentId, global: true }),
        GetByNames:  (parentId, names)       => _rpc('Properties', 'GetByNames',  { names, parentId, global: true }),
        GetProperties: (parentId)            => _rpc('Properties', 'GetProperties',{ parentId, global: true }),
        Set:         (parentId, name, val)   => _rpc('Properties', 'Set',         { name, value: val, parentId, global: true }),
        SetMany:     (parentId, props)       => _rpc('Properties', 'SetMany',     { properties: props, parentId, global: true }),
        Init:        (parentId, name, val)   => _rpc('Properties', 'Init',        { name, value: val, parentId, global: true }),
        InitMany:    (parentId, props)       => _rpc('Properties', 'InitMany',    { properties: props, parentId, global: true }),
        Remove:      (parentId, name)        => _rpc('Properties', 'Remove',      { name, parentId, global: true }),

        Subscribe: (parentId, name, cb) => {
          const key = parentId + ':' + name;
          if (!_globalPropSubscriptions[key]) _globalPropSubscriptions[key] = [];
          _globalPropSubscriptions[key].push(cb);
        },
        Unsubscribe: (parentId, name, cb) => {
          const key = parentId + ':' + name;
          const arr = _globalPropSubscriptions[key];
          if (!arr) return;
          const i = arr.indexOf(cb);
          if (i !== -1) arr.splice(i, 1);
        },
      }),
    },

    Resources: {
      Create: (key, data, name, mimeType) => _rpc('Resources', 'Create', { key, data, name, mimeType }),
      Read:   (key)                        => _rpc('Resources', 'Read',   { key }),
      Update: (key, data, mimeType)        => _rpc('Resources', 'Update', { key, data, mimeType }),
      Delete: (key)                        => _rpc('Resources', 'Delete', { key }),
      Upsert: (key, data, name, mimeType)  => _rpc('Resources', 'Upsert', { key, data, name, mimeType }),
      /** Any game resource the player may read, by id (e.g. a Materials file). */
      ReadById: (id)                       => _rpc('Resources', 'ReadById', { id }),
      /** The game's resources this player can see, without data; filter: { mimeType }. */
      List:   (filter)                     => _rpc('Resources', 'List',   { filter }),
      /** Part of a game resource ({ id } or { key }): { bytes, start, total, version }. */
      ReadRange: (ref, start, length)      => _rpc('Resources', 'ReadRange', { ref, start, length }),
      /** A file handle ({ size, mimeType, version, read, blob, text, json, mediaUrl }), or null.
       *  ref: a game-wide key, { key } or { id }. */
      Open: async (ref) => {
        const meta = await _rpc('Resources', 'Open', { ref });
        return meta ? _fileHandle(meta) : null;
      },
      /** Stores a file: { id, key }. options: { key, name, mimeType, global, storage: 'file' }. */
      Upload: (data, options, onProgress) => _rpc('Resources', 'Upload', { data, options: options || {} }, onProgress),

      /** Game-wide resources — key is NOT scoped to this card. */
      Global: Object.freeze({
        Create: (key, data, name, mimeType, options) => _rpc('Resources', 'Create', { key, data, name, mimeType, options, global: true }),
        Read:   (key)                        => _rpc('Resources', 'Read',   { key, global: true }),
        Update: (key, data, mimeType)        => _rpc('Resources', 'Update', { key, data, mimeType, global: true }),
        Delete: (key)                        => _rpc('Resources', 'Delete', { key, global: true }),
        Upsert: (key, data, name, mimeType)  => _rpc('Resources', 'Upsert', { key, data, name, mimeType, global: true }),
      }),
    },

    ClientMediator: {
      sendCommand:      (panel, cmd, data) => _rpc('__mediator__', panel, { command: cmd, data }),
      sendCommandAsync: (panel, cmd, data) => _rpc('__mediator__', panel, { command: cmd, data }),

      // An addon panel: handlers stay in this frame, the app forwards each call here
      // (MEDIATOR_CALL). Resolves to the scoped name others call it by.
      register: (name, handlers) => {
        const commands = Object.keys(handlers ?? {}).filter((k) => typeof handlers[k] === 'function');
        _registrations[name] = handlers;
        return _rpc('__register__', name, { commands });
      },
      unregister: (name) => {
        delete _registrations[name];
        return _rpc('__unregister__', name, {});
      },
    },

    // Must match the real backend WS command (ChatHandler.cs's "chat_push"
    // case, also what src/CardAPI.js's own non-sandboxed SendChatMessage
    // sends) — ALLOWED_WS_COMMANDS only permits "chat_push", so anything
    // else is silently blocked by CardPanel.js's SendCustomCommandToServer.
    SendChatMessage: (message) => _sendToServer('chat_push', message),

    FireAction: (action, args) => _sendToServer('execute_action', { action, args }),

    SendCustomCommandToServer: (command, data) => _sendToServer(command, data),

    // Closes the dockable panel this card is hosted in — e.g. a creator/wizard
    // card that should dismiss itself once its job (create X) is done.
    Close: () => parent.postMessage({ type: 'CLOSE_PANEL' }, '*'),

    // Roll now, post later — see src/CardAPI.js Rolls. Start resolves to
    // { rollId, results: [{ key, roll }] }; Finish posts one Html chat message.
    Rolls: {
      Start:  (formulas) => _rpc('Rolls', 'Start',  { formulas }),
      Finish: (payload)  => _rpc('Rolls', 'Finish', payload),
    },

    SubscribeWebSocket: (cb) => { _wsSubscriptions.push(cb); },
    UnsubscribeWebSocket: (cb) => {
      const i = _wsSubscriptions.indexOf(cb);
      if (i !== -1) _wsSubscriptions.splice(i, 1);
    },
  };

  Object.freeze(CardAPI.Properties);
  Object.freeze(CardAPI.Resources);
  Object.freeze(CardAPI.Rolls);
  Object.freeze(CardAPI.ClientMediator);
  Object.freeze(CardAPI);

  window.CardAPI = CardAPI;

  // ── Inbound message handler ───────────────────────────────────────────────
  // Accept only messages carrying this frame's nonce. Checking \`event.source\`
  // against \`parent\` doesn't work for a panel popped out to its own window
  // (BrowserWindowPortal): the iframe's DOM parent is that window, while the
  // host's postMessage calls come from the main app window's realm.
  window.addEventListener('message', (event) => {
    const msg = event.data ?? {};
    if (msg.nonce !== _nonce) return;

    switch (msg.type) {
      case 'INIT':
        _cardId              = msg.cardId;
        _additionalArguments = msg.additionalArguments;
        window.dispatchEvent(new CustomEvent('cardapi:ready', { detail: CardAPI }));
        break;

      case 'CMD_RESULT': {
        const pending = _pending[msg.reqId];
        if (!pending) break;
        delete _pending[msg.reqId];
        if (msg.error) pending.reject(new Error(msg.error));
        else           pending.resolve(msg.result);
        break;
      }

      case 'PROPERTY_EVENT': {
        if (msg.global) {
          // Global property event — keyed by "parentId:name"
          const key = msg.parentId + ':' + msg.name;
          const gsubs = _globalPropSubscriptions[key];
          if (gsubs?.length) {
            for (const cb of gsubs) {
              try { cb(msg.propData); } catch (e) { console.error('CardAPI global prop subscriber error', e); }
            }
          }
        } else {
          const subs = _propSubscriptions[msg.name];
          if (!subs?.length) break;
          for (const cb of subs) {
            try { cb(msg.propData); } catch (e) { console.error('CardAPI prop subscriber error', e); }
          }
        }
        break;
      }

      case 'APP_STYLES':
        // The app's styles for a card that opts into them changed (the game's
        // theme). Only ever text in a <style>, never parsed as HTML.
        for (const [id, css] of [['nm-app-base', msg.base], ['nm-app-theme', msg.theme]]) {
          const current = document.getElementById(id);
          if (!current || typeof css !== 'string') continue;
          let style = current;
          if (current.tagName !== 'STYLE') {
            style = document.createElement('style');
            style.id = id;
            current.replaceWith(style);
          }
          style.textContent = css;
        }
        break;

      case 'MEDIATOR_CALL': {
        const reply = (result, error) =>
          parent.postMessage({ type: 'MEDIATOR_RESULT', reqId: msg.reqId, result, error }, '*');
        const handler = _registrations[msg.name]?.[msg.command];
        if (typeof handler !== 'function') {
          reply(null, 'CardAPI: ' + msg.name + ' has no command ' + msg.command);
          break;
        }
        Promise.resolve()
          .then(() => handler(msg.data))
          .then((result) => reply(result ?? null), (e) => reply(null, String(e?.message ?? e)));
        break;
      }

      case 'RESOURCE_PROGRESS': {
        const pending = _pending[msg.reqId];
        if (pending && pending.progress) pending.progress(msg.fraction);
        break;
      }

      case 'WS_EVENT':
        for (const cb of _wsSubscriptions) {
          try { cb({ command: msg.command, data: msg.data }); }
          catch (e) { console.error('CardAPI WS subscriber error', e); }
        }
        break;
    }
  });
  // ── Signal ready ──────────────────────────────────────────────────────────
  // SANDBOX_READY is sent only after the window 'load' event, which fires
  // after ALL deferred scripts (including the CRA bundle) have executed and
  // registered their 'cardapi:ready' listeners.  Sending it from the inline
  // script would race with defer scripts that haven't run yet.
  window.addEventListener('load', () => {
    parent.postMessage({ type: 'SANDBOX_READY' }, '*');
  });
})();
</script>`;
