/**
 * cardSandbox.js
 *
 * Exports the CardAPI bridge <script> block injected into every card's HTML
 * before it is loaded into the sandboxed iframe.
 *
 * Security model
 * ──────────────
 * • The main resource is ALWAYS a text/html file supplied by the card author.
 * • It runs inside a cross-origin iframe (blob: URL + sandbox="allow-scripts").
 * • The iframe has NO allow-same-origin → it has a null origin and cannot
 *   access the parent page's cookies, localStorage, or DOM at all.
 * • The iframe boundary IS the isolation boundary. The sandbox host may still
 *   use an internal Shadow DOM for its own layout, so cards must mount into the
 *   host-provided `cardRoot` container rather than assuming a framework can find
 *   its mount point via document.getElementById(...).
 * • CSS from additional resources is injected as normal <link> tags in <head>.
 *   Because the iframe is cross-origin, those styles never affect the parent.
 * • The only communication channel is postMessage (structured-clone; no
 *   function refs can cross the boundary).
 *
 * postMessage protocol (parent → sandbox)
 * ─────────────────────────────────────────
 *   { type: "INIT",           cardId, additionalArguments }
 *   { type: "CMD_RESULT",     reqId, result, error? }
 *   { type: "PROPERTY_EVENT", eventType, name, propData, global?, parentId? }
 *   { type: "WS_EVENT",       command, data }
 *
 * postMessage protocol (sandbox → parent)
 * ─────────────────────────────────────────
 *   { type: "SANDBOX_READY" }
 *   { type: "CMD",     reqId, panel, command, data }
 *   { type: "WS_SEND", command, data }
 */

/**
 * The CardAPI bootstrap <script> block.
 * Injected verbatim into the card's HTML just before </body>.
 */
export const SANDBOX_BRIDGE_SCRIPT = `<script>
(function () {
  'use strict';

  // ── RPC state ─────────────────────────────────────────────────────────────
  let _reqCounter = 0;
  const _pending = {};                  // reqId → { resolve, reject }
  const _propSubscriptions = {};        // name → callback[]
  const _globalPropSubscriptions = {};  // "parentId:name" → callback[]
  const _wsSubscriptions   = [];        // callback[]

  // Mutable identity fields — written once on INIT
  let _cardId              = null;
  let _additionalArguments = null;

  function _rpc(panel, command, data) {
    return new Promise((resolve, reject) => {
      const reqId = 'r' + (++_reqCounter);
      _pending[reqId] = { resolve, reject };
      parent.postMessage({ type: 'CMD', reqId, panel, command, data }, '*');
    });
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

      /** Game-wide resources — key is NOT scoped to this card. */
      Global: Object.freeze({
        Create: (key, data, name, mimeType) => _rpc('Resources', 'Create', { key, data, name, mimeType, global: true }),
        Read:   (key)                        => _rpc('Resources', 'Read',   { key, global: true }),
        Update: (key, data, mimeType)        => _rpc('Resources', 'Update', { key, data, mimeType, global: true }),
        Delete: (key)                        => _rpc('Resources', 'Delete', { key, global: true }),
        Upsert: (key, data, name, mimeType)  => _rpc('Resources', 'Upsert', { key, data, name, mimeType, global: true }),
      }),
    },

    ClientMediator: {
      sendCommand:      (panel, cmd, data) => _rpc(panel, cmd, data),
      sendCommandAsync: (panel, cmd, data) => _rpc(panel, cmd, data),
      register: (name, manager) => _rpc('__register__', name, manager),
    },

    // Must match the real backend WS command (ChatHandler.cs's "chat_push"
    // case, also what src/CardAPI.js's own non-sandboxed SendChatMessage
    // sends) — ALLOWED_WS_COMMANDS only permits "chat_push", so anything
    // else is silently blocked by CardPanel.js's SendCustomCommandToServer.
    SendChatMessage: (message) =>
      parent.postMessage({ type: 'WS_SEND', command: 'chat_push', data: message }, '*'),

    FireAction: (action, args) =>
      parent.postMessage({ type: 'WS_SEND', command: 'execute_action', data: { action, args } }, '*'),

    SendCustomCommandToServer: (command, data) =>
      parent.postMessage({ type: 'WS_SEND', command, data }, '*'),

    SubscribeWebSocket: (cb) => { _wsSubscriptions.push(cb); },
    UnsubscribeWebSocket: (cb) => {
      const i = _wsSubscriptions.indexOf(cb);
      if (i !== -1) _wsSubscriptions.splice(i, 1);
    },
  };

  Object.freeze(CardAPI.Properties);
  Object.freeze(CardAPI.Resources);
  Object.freeze(CardAPI.ClientMediator);
  Object.freeze(CardAPI);

  window.CardAPI = CardAPI;

  // ── Inbound message handler ───────────────────────────────────────────────
  window.addEventListener('message', (event) => {
    if (event.source !== parent) return;
    const msg = event.data ?? {};

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
