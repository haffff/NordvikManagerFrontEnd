import { wait } from "@testing-library/user-event/dist/cjs/utils/index.js";

export const ClientMediator = {
  /*
    ClientHashset structure
    {
        Panel1: {
            client1id: { command1 :       this._clientsHashSet[panelKey][clientId] = client;
      this._clientPanelIndex[clientId] = panelKey;
      // Apply any methods that were patched before this client registered
      if (this._pendingPatches?.[clientId]) {
        Object.assign(this._clientsHashSet[panelKey][clientId], this._pendingPatches[clientId]);
        delete this._pendingPatches[clientId];
      }
      console.log(`ClientMediator: registered '${client.id}' for panel '${client.panel}'`);ction, command2 : function },
            client2id: { command1 : function, command2 : function }
        }
    }
    */
  _clientsHashSet: {},
  // Maps clientId -> panelKey for O(1) unregister
  _clientPanelIndex: {},
  _awaitingRequests: [],
  // Lightweight dedup: tracks the last fired event by reference/time, not a full JSON stringify
  _lastFiredEvent: { name: null, data: null, time: 0 },

  // ─── Internal helpers ────────────────────────────────────────────────────────

  /** Resolves the client list for a panel, optionally filtered by contextId. */
  _resolveClients: function (panel, data) {
    const panelKey = panel.toLowerCase();
    const bucket = this._clientsHashSet[panelKey];
    if (!bucket) return null;

    const all = Object.values(bucket);
    if (data && data.contextId) {
      return all.filter((x) => x.contextId === data.contextId);
    }
    return all;
  },

  // ─── Command dispatch ────────────────────────────────────────────────────────

  sendCommand: function (panel, command, data) {
    const clients = this._resolveClients(panel, data);
    if (!clients || clients.length === 0) return undefined;

    if (clients.length === 1) {
      try {
        return clients[0][command](data);
      } catch (e) {
        throw new Error(`Command not found: ${command} for panel: ${panel} with data: ${JSON.stringify(data)}`);
      }
    }

    const results = clients.reduce((acc, client) => {
      if (client[command]) {
        const r = client[command](data);
        if (r !== undefined) acc.push(r);
      }
      return acc;
    }, []);

    return results.length === 1 ? results[0] : results.length > 1 ? results : undefined;
  },

  sendCommandAsync: async function (panel, command, data) {
    const clients = this._resolveClients(panel, data);
    if (!clients || clients.length === 0) return undefined;

    if (clients.length === 1) {
      try {
        return await clients[0][command](data);
      } catch (e) {
        throw new Error(`Command not found: ${command} for panel: ${panel} with data: ${JSON.stringify(data)}`);
      }
    }

    const settled = await Promise.all(
      clients.map((client) => (client[command] ? client[command](data) : undefined))
    );
    const results = settled.filter((x) => x !== undefined);
    return results.length === 1 ? results[0] : results.length > 1 ? results : undefined;
  },

  /** Synchronous send — queues the request if the panel isn't registered yet. */
  sendCommandWaitForRegister: function (panel, command, data, waitUntilAvailable = false) {
    const result = this.sendCommand(panel, command, data);
    if (result !== undefined) return Promise.resolve(result);

    if (!waitUntilAvailable) return Promise.reject("Client not found.");

    return new Promise((resolve, reject) => {
      this._awaitingRequests.push({ panel, command, uniqueKey: data?.uniqueKey, data, resolve, reject });
    });
  },

  /** Async send — queues the request if the panel isn't registered yet. */
  sendCommandWaitForRegisterAsync: async function (panel, command, data, waitUntilAvailable = false) {
    const result = await this.sendCommandAsync(panel, command, data);
    if (result !== undefined) return result;

    if (!waitUntilAvailable) {
      console.warn("Client not found.");
      return undefined;
    }

    const alreadyPending = this._awaitingRequests.find(
      (x) =>
        x.panel.toLowerCase() === panel.toLowerCase() &&
        x.command === command &&
        x.uniqueKey === data?.uniqueKey
    );
    if (alreadyPending) {
      console.warn("Request already pending.");
      return undefined;
    }

    return new Promise((resolve, reject) => {
      this._awaitingRequests.push({ panel, command, uniqueKey: data?.uniqueKey, data, resolve, reject });
    });
  },

  // ─── Registration ────────────────────────────────────────────────────────────

  register: function (client) {
    const panelKey = client.panel.toLowerCase();
    const clientId = client.id;

    if (!this._clientsHashSet[panelKey]) {
      this._clientsHashSet[panelKey] = {};
    }

    if (this._clientsHashSet[panelKey][clientId]) {
      // Re-register: update in place so awaiting requests still resolve correctly
      this._clientsHashSet[panelKey][clientId] = client;
      console.warn(`ClientMediator: re-registered client '${clientId}' for panel '${client.panel}'`);
    } else {
      this._clientsHashSet[panelKey][clientId] = client;
      this._clientPanelIndex[clientId] = panelKey;
      console.log(`ClientMediator: registered '${clientId}' for panel '${client.panel}'`);
    }    this._checkAwaitingAndExecute();
  },

  /**
   * Merges additional methods/properties onto an already-registered client
   * without replacing the whole object.  Safe to call before or after register —
   * if the client doesn't exist yet it falls back to register().
   */
  patchClient: function (id, methods) {
    const panelKey = this._clientPanelIndex[id];
    if (panelKey && this._clientsHashSet[panelKey]?.[id]) {
      Object.assign(this._clientsHashSet[panelKey][id], methods);
    } else {
      // Client not registered yet — queue as a full registration so awaiting
      // requests can still resolve once it eventually registers.
      console.warn(`ClientMediator.patchClient: client '${id}' not found, deferring patch`);
      this._pendingPatches = this._pendingPatches || {};
      this._pendingPatches[id] = { ...(this._pendingPatches[id] || {}), ...methods };
    }
  },
  unregister: function (id) {
    const panelKey = this._clientPanelIndex[id];
    if (panelKey && this._clientsHashSet[panelKey]) {
      delete this._clientsHashSet[panelKey][id];
      // Clean up empty panel buckets
      if (Object.keys(this._clientsHashSet[panelKey]).length === 0) {
        delete this._clientsHashSet[panelKey];
      }
    }
    delete this._clientPanelIndex[id];
  },

  _checkAwaitingAndExecute: async function () {
    if (this._awaitingRequests.length === 0) return;

    // Snapshot then clear; resolved items won't be re-processed
    const pending = this._awaitingRequests.slice();
    const stillPending = [];

    await Promise.all(
      pending.map(async (request) => {
        try {
          const result = await this.sendCommandAsync(request.panel, request.command, request.data);
          if (result !== undefined) {
            console.log(`ClientMediator: resolved awaiting '${request.command}' -> '${request.panel}'`);
            request.resolve(result);
          } else {
            stillPending.push(request);
          }
        } catch (e) {
          console.error(`ClientMediator: awaiting request failed '${request.command}' -> '${request.panel}'`, e);
          request.reject(e);
        }
      })
    );

    this._awaitingRequests = stillPending;
  },

  // ─── Events ──────────────────────────────────────────────────────────────────

  _eventListeners: [],

  _addEventListener: function (handler) {
    this._eventListeners.push(handler);
  },

  _removeEventListener: function (handler) {
    this._eventListeners = this._eventListeners.filter((h) => h !== handler);
    },

    fireEvent: function (eventName, data) {
    try {
      const now = Date.now();

      const last = this._lastFiredEvent;
      if (last.name === eventName && now - last.time < 200 && last.data === data) {
      return;
      }

      this._lastFiredEvent = { name: eventName, data, time: now };

      setTimeout(() => {
      // Dispatch to panel clients
      for (const bucket of Object.values(this._clientsHashSet)) {
        for (const client of Object.values(bucket)) {
        if (client.onEvent) {
          try {
          client.onEvent(eventName, data);
          } catch (e) {
          console.error('ClientMediator.fireEvent: client.onEvent threw', e, { clientId: client.id, eventName });
          }
        }
        }
      }
      // Dispatch to standalone event listeners
      for (const handler of this._eventListeners.slice()) {
        try {
        handler(eventName, data);
        } catch (e) {
        console.error('ClientMediator.fireEvent: event listener threw', e, { eventName });
        }
      }
      }, 0);
    } catch (e) {
      console.error('ClientMediator.fireEvent: unexpected error', e, { eventName });
    }
    },

    waitForEvent: function (eventName, filterFn, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const handler = (eName, data) => {
        if (eName === eventName && (!filterFn || filterFn(data))) {
          ClientMediator._removeEventListener(handler);
          resolve(data);
        }
      };
      ClientMediator._addEventListener(handler);
      setTimeout(() => {
        ClientMediator._removeEventListener(handler);
        reject(new Error(`waitForEvent: timeout after ${timeout}ms`));
      }, timeout);
    });
  },
};

export default ClientMediator;
