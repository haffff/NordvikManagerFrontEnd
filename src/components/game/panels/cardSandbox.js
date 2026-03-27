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
 * • The iframe boundary IS the isolation boundary — no Shadow DOM is needed
 *   inside the iframe, and adding one would break card frameworks (React, Vue,
 *   etc.) that rely on document.getElementById to find their mount point.
 * • CSS from additional resources is injected as normal <link> tags in <head>.
 *   Because the iframe is cross-origin, those styles never affect the parent.
 * • The only communication channel is postMessage (structured-clone; no
 *   function refs can cross the boundary).
 *
 * postMessage protocol (parent → sandbox)
 * ─────────────────────────────────────────
 *   { type: "INIT",           cardId, additionalArguments }
 *   { type: "CMD_RESULT",     reqId, result, error? }
 *   { type: "PROPERTY_EVENT", eventType, name, propData }
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
  const _pending = {};           // reqId → { resolve, reject }
  const _propSubscriptions = {}; // name → callback[]
  const _wsSubscriptions   = []; // callback[]

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
        if (!arr) return;
        const i = arr.indexOf(cb);
        if (i !== -1) arr.splice(i, 1);
      },
    },

    ClientMediator: {
      sendCommand:      (panel, cmd, data) => _rpc(panel, cmd, data),
      sendCommandAsync: (panel, cmd, data) => _rpc(panel, cmd, data),
      register: (name, manager) => _rpc('__register__', name, manager),
    },

    SendChatMessage: (message) =>
      parent.postMessage({ type: 'WS_SEND', command: 'chat_message', data: message }, '*'),

    FireAction: (action, args) =>
      parent.postMessage({ type: 'WS_SEND', command: 'action_execute', data: { action, args } }, '*'),

    SendCustomCommandToServer: (command, data) =>
      parent.postMessage({ type: 'WS_SEND', command, data }, '*'),

    SubscribeWebSocket: (cb) => { _wsSubscriptions.push(cb); },
    UnsubscribeWebSocket: (cb) => {
      const i = _wsSubscriptions.indexOf(cb);
      if (i !== -1) _wsSubscriptions.splice(i, 1);
    },
  };

  Object.freeze(CardAPI.Properties);
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
        const subs = _propSubscriptions[msg.name];
        if (!subs?.length) break;
        for (const cb of subs) {
          try { cb(msg.propData); } catch (e) { console.error('CardAPI prop subscriber error', e); }
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
