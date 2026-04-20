import ClientMediator from "./ClientMediator";
import { ActiveTransportManager as WebSocketManagerInstance, ActiveWebHelper as WebHelper } from "./helpers/transport";
import UtilityHelper from "./helpers/UtilityHelper";

// ─── Security: allowlists ─────────────────────────────────────────────────────

/**
 * Commands that card addons are permitted to execute via ClientMediator.
 * Format: "Panel.Command" → true
 *
 * Anything not listed here is BLOCKED — addons cannot call Game.DeleteGame,
 * BattleMap.DeleteAllElements, etc.
 */
const ALLOWED_COMMANDS = Object.freeze({
  // Properties (scoped to own card by the API — parentId is forced)
  "Properties.GetByNames": true,
  "Properties.Add": true,
  "Properties.Update": true,
  "Properties.Remove": true,
  "Properties.GetProperties": true,

  // Read-only game queries
  "Game.GetPlayers": true,
  "Game.GetCurrentPlayer": true,
  "Game.GetGameId": true,

  // BattleMap read-only
  "BattleMap.GetSelectedMap": true,

  // Chat (sending only — receiving is via WS subscription)
  "Chat.SendMessage": true,
});

/**
 * WebSocket commands that card addons are permitted to send to the server.
 * Anything prefixed with "custom_" is always allowed (addon namespace).
 */
const ALLOWED_WS_COMMANDS = Object.freeze({
  chat_push: true,
  execute_action: true,
});

/**
 * WebSocket event prefixes that card addons are permitted to receive.
 * Notifications about their own properties, chat, and custom events.
 */
const ALLOWED_WS_RECEIVE_PREFIXES = Object.freeze([
  "property_",
  "chat_",
  "custom_",
  "action_",
]);

// ─── Constants ───────────────────────────────────────────────────────────────

const ADDON_PANEL_PREFIX = "addon_";

// ─── CardAPI ──────────────────────────────────────────────────────────────────

class CardAPI {
  _propertySubscriptions = {};
  _propertyCache = new Map();
  _registeredPanels = new Set();
  _cardId = null;
  _destroyed = false;

  _id = UtilityHelper.GenerateUUID();
  _subscriptionKey;

  constructor(cardId) {
    this._cardId = cardId;
    this._subscriptionKey = "CardAPI_" + this._id;

    WebSocketManagerInstance.Subscribe(this._subscriptionKey, (message) => {
      if (this._destroyed) return;
      this._handleWebSocketMessage(message);
    });
  }

  // ── WebSocket message router ────────────────────────────────────────────

  _handleWebSocketMessage(message) {
    const { command, data } = message;    
    
    if (command === "property_notify") {
      if (data.id !== this._cardId) return;

      // Only fetch properties that have active subscribers
      const subscribedNames = data.names?.filter(
        (n) => this._propertySubscriptions[n]?.length > 0
      );
      if (!subscribedNames?.length) return;

      // Invalidate stale cache entries before fetching so GetMany goes to server
      this._invalidateCache(subscribedNames);

      this.Properties.GetMany(subscribedNames).then((props) => {
        for (const prop of props) {
          this._updateCache(prop);
          this._notifySubscribers(prop.name, prop);
        }
      });
      return;
    }

    if (command === "property_add" || command === "property_update") {
      if (data.parentId !== this._cardId) return;
      this._updateCache(data);
      this._notifySubscribers(data.name, data);
      return;
    }

    if (command === "property_remove") {
      if (data.parentId !== this._cardId) return;
      this._propertyCache.delete(data.name);
      this._notifySubscribers(data.name, null);
      return;
    }
  }

  _notifySubscribers(propertyName, data) {
    const callbacks = this._propertySubscriptions[propertyName];
    if (!callbacks?.length) return;
    for (const cb of callbacks) {
      try {
        cb(data);
      } catch (err) {
        console.error(`CardAPI: subscriber error for "${propertyName}"`, err);
      }
    }
  }

  _updateCache(property) {
    if (property?.name) {
      this._propertyCache.set(property.name, property);
    }
  }

  _invalidateCache(names) {
    if (Array.isArray(names)) {
      for (const n of names) this._propertyCache.delete(n);
    } else {
      this._propertyCache.delete(names);
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────
  async InitApi() {
    // Bulk-fetch ALL properties for this card up front and warm the cache.
    // This means the first Get/GetMany calls from the sandbox hit the cache
    // instead of making individual server round-trips.
    try {
      const props = await WebHelper.getAsync(
        `properties/QueryProperties?parentIds=${this._cardId}`
      );
      if (Array.isArray(props)) {
        for (const prop of props) {
          this._updateCache(prop);
        }
      }
    } catch (err) {
      // Non-fatal — the cache stays empty and individual calls will fetch lazily
      console.warn("CardAPI: prefetch properties failed", err);
    }
  }
  destroy() {
    this._destroyed = true;
    this._propertySubscriptions = {};
    this._propertyCache.clear();
    WebSocketManagerInstance.Unsubscribe(this._subscriptionKey);

    // Unregister all addon panels registered by this card instance
    for (const panelId of this._registeredPanels) {
      ClientMediator.unregister(panelId);
    }
    this._registeredPanels.clear();
  }

  // ── Properties API ──────────────────────────────────────────────────────

  Properties = {
    /**
     * Initialise a single property — creates it only if it doesn't exist.
     */
    Init: async (propertyName, value) => {
      const existing = await this.Properties.GetMany([propertyName]);

      if (!existing?.length) {
        const added = await this._sendCommand("Properties", "Add", {
          property: {
            entityName: "CardModel",
            name: propertyName,
            value,
            parentId: this._cardId,
          },
        });
        if (added) this._updateCache(added);
      }
    },

    /**
     * Initialise multiple properties — creates only those that don't exist yet.
     * Waits for all Add operations to complete before returning.
     */
    InitMany: async (properties) => {
      const existing = await this.Properties.GetMany(properties.map((p) => p.name));

      const existingNames = new Set(existing?.map((p) => p.name) ?? []);
      const missing = properties.filter((p) => !existingNames.has(p.name));

      if (!missing.length) return;

      await Promise.all(
        missing.map((p) =>
          this._sendCommand("Properties", "Add", {
            property: {
              entityName: "CardModel",
              name: p.name,
              value: p.value,
              parentId: this._cardId,
            },
          }).then((added) => { if (added) this._updateCache(added); })
        )
      );
    },

    /**
     * Get a single property by name. Uses cache if available.
     */
    Get: async (propertyName) => {
      const cached = this._propertyCache.get(propertyName);
      if (cached) return cached;

      // Direct fetch into this card's own cache (scoped to _cardId)
      const fetched = await WebHelper.getAsync(
        `properties/QueryProperties?parentIds=${this._cardId}&names=${encodeURIComponent(propertyName)}`
      );
      const prop = fetched?.[0];
      if (prop) this._updateCache(prop);
      return prop;
    },

    /**
     * Get multiple properties by name. Fetches only uncached ones from the server.
     * Also exposed as GetByNames for compatibility with cards that call it directly.
     */
    GetMany: async (propertyNames) => {
      const names = Array.isArray(propertyNames) ? propertyNames : [propertyNames];
      const results = [];
      const uncached = [];

      for (const name of names) {
        const cached = this._propertyCache.get(name);
        if (cached) results.push(cached);
        else uncached.push(name);
      }

      if (uncached.length) {
        // Direct fetch into this card's own cache (scoped to _cardId)
        const fetched = await WebHelper.getAsync(
          `properties/QueryProperties?parentIds=${this._cardId}&names=${uncached.map(encodeURIComponent).join(",")}`
        );
        if (fetched?.length) {
          for (const prop of fetched) {
            this._updateCache(prop);
            results.push(prop);
          }
        }
      }

      return results;
    },

    /**
     * GetByNames — alias for GetMany, accepts { names } data object or a names array.
     * Cards that call ClientMediator.sendCommandAsync("Properties","GetByNames",{names})
     * are routed here so they benefit from the cache.
     */
    GetByNames: async (propertyNames) => {
      return this.Properties.GetMany(propertyNames);
    },

    /**
     * GetProperties — returns ALL cached properties for this card.
     * Falls back to a fresh server fetch only if the cache is completely empty
     * (i.e. InitApi prefetch failed).
     */
    GetProperties: async () => {
      if (this._propertyCache.size > 0) {
        return Array.from(this._propertyCache.values());
      }
      // Cache is empty — re-run the bulk fetch
      const props = await WebHelper.getAsync(
        `properties/QueryProperties?parentIds=${this._cardId}`
      );
      if (Array.isArray(props)) {
        for (const prop of props) this._updateCache(prop);
      }
      return props ?? [];
    },

    /**
     * Set a single property — updates if it exists (and value changed),
     * creates if it doesn't.
     */    Set: async (propertyName, value) => {
      const prop = await this.Properties.Get(propertyName);

      if (prop) {
        // Compare as strings — the server may return numbers as strings or vice
        // versa, so a strict === would falsely detect a change and send an
        // unnecessary property_update for every computed field on card open.
        // eslint-disable-next-line eqeqeq
        if (prop.value == value) return; // No change (type-coerced)

        // Optimistically update cache with new value BEFORE the round-trip so
        // any concurrent Get/Set calls for the same name don't go to the server.
        this._updateCache({ ...prop, value });
        await this._sendCommand("Properties", "Update", {
          property: {
            id: prop.id,
            name: propertyName,
            value,
            parentId: this._cardId,
            entityName: "CardModel",
          },
        });
      } else {
        const added = await this._sendCommand("Properties", "Add", {
          property: {
            name: propertyName,
            value,
            parentId: this._cardId,
            entityName: "CardModel",
          },
        });
        if (added) this._updateCache(added);
      }
    },    /**
     * Set multiple properties — batches updates and adds.
     * Waits for all operations to complete.
     */
    SetMany: async (properties) => {
      const existing = await this.Properties.GetMany(properties.map((p) => p.name));

      const existingMap = new Map(
        (existing ?? []).map((p) => [p.name, p])
      );

      const updates = [];
      const adds = [];

      for (const prop of properties) {
        const found = existingMap.get(prop.name);
        if (found) {
          // eslint-disable-next-line eqeqeq
          if (found.value == prop.value) continue; // No change (type-coerced)
          // Optimistically update cache so concurrent reads don't go to server
          this._updateCache({ ...found, value: prop.value });
          updates.push(
            this._sendCommand("Properties", "Update", {
              property: {
                id: found.id,
                name: prop.name,
                value: prop.value,
                parentId: this._cardId,
                entityName: "CardModel",
              },
            })
          );
        } else {
          adds.push(
            this._sendCommand("Properties", "Add", {
              property: {
                name: prop.name,
                value: prop.value,
                parentId: this._cardId,
                entityName: "CardModel",
              },
            }).then((added) => { if (added) this._updateCache(added); })
          );
        }
      }

      await Promise.all([...updates, ...adds]);
    },

    /**
     * Remove a property by name.
     */
    Remove: async (propertyName) => {
      const prop = await this.Properties.Get(propertyName);
      if (!prop) return;

      this._invalidateCache(propertyName);
      await this._sendCommand("Properties", "Remove", {
        propertyId: prop.id,
      });
    },

    /**
     * Subscribe to property changes.
     */
    Subscribe: (propertyName, callback) => {
      if (!this._propertySubscriptions[propertyName]) {
        this._propertySubscriptions[propertyName] = [];
      }
      this._propertySubscriptions[propertyName].push(callback);
    },

    /**
     * Unsubscribe from property changes.
     */
    Unsubscribe: (propertyName, callback) => {
      const subs = this._propertySubscriptions[propertyName];
      if (!subs) return;

      const index = subs.indexOf(callback);
      if (index !== -1) {
        subs.splice(index, 1);
      }
    },
  };

  // ── Sandboxed ClientMediator ────────────────────────────────────────────

  /**
   * Internal: send a command through ClientMediator with allowlist enforcement.
   * All Properties commands have parentId forced to this card's ID.
   */
  async _sendCommand(panel, command, data) {
    const key = `${panel}.${command}`;
    if (!ALLOWED_COMMANDS[key]) {
      console.error(
        `CardAPI: blocked command "${key}" — not in allowlist`
      );
      return undefined;
    }

    return ClientMediator.sendCommandAsync(panel, command, data);
  }

  /**
   * Exposed to addons — restricted to allowed commands only.
   * Does NOT expose `register()`.
   */  ClientMediator = {
    sendCommand: (panel, command, data) => {
      const key = `${panel}.${command}`;
      if (!ALLOWED_COMMANDS[key]) {
        console.error(
          `CardAPI: blocked command "${key}" — not in allowlist`
        );
        return undefined;
      }
      return ClientMediator.sendCommand(panel, command, data);
    },
    sendCommandAsync: (panel, command, data) => {
      return this._sendCommand(panel, command, data);
    },

    /**
     * Register a panel/manager under the addon namespace.
     *
     * Rules:
     *  - Name MUST start with "addon_"
     *  - The actual registered name is scoped to this card:
     *    "addon_{cardId}_{name}" — prevents cross-addon collisions / squatting.
     *  - The registration is tracked and automatically cleaned up on destroy().
     *
     * @returns {string} The scoped name that was registered (use this when
     *   calling sendCommand to reach this panel from another addon).
     */
    register: (name, manager) => {
      if (!name.startsWith(ADDON_PANEL_PREFIX)) {
        console.error(
          `CardAPI: register() name must start with "${ADDON_PANEL_PREFIX}" — got "${name}"`
        );
        return undefined;
      }

      // Scope to this card's ID so two addons can register "addon_toolbar" without colliding
      const scopedName = `${ADDON_PANEL_PREFIX}${this._cardId}_${name.slice(ADDON_PANEL_PREFIX.length)}`;

      if (this._registeredPanels.has(scopedName)) {
        console.warn(`CardAPI: panel "${scopedName}" already registered — skipping`);
        return scopedName;
      }

      ClientMediator.register({
        ...manager,
        id: scopedName,
        panel: scopedName,
      });

      this._registeredPanels.add(scopedName);
      return scopedName;
    },

    // NOTE: unregister() is intentionally NOT exposed directly — cleanup happens
    // automatically via destroy(). Addons should not unregister each other's panels.
  };

  // ── Chat ────────────────────────────────────────────────────────────────

  SendChatMessage(message) {
    this._sendWsCommand("chat_push", message);
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  FireAction(action, args) {
    this._sendWsCommand("execute_action", { action, args });
  }

  // ── Sandboxed WebSocket send ────────────────────────────────────────────

  /**
   * Send a custom command to the server.
   * Only allowed WS commands and commands prefixed with "custom_" are permitted.
   */
  SendCustomCommandToServer(command, data) {
    this._sendWsCommand(command, data);
  }

  _sendWsCommand(command, data) {
    if (!ALLOWED_WS_COMMANDS[command] && !command.startsWith("custom_")) {
      console.error(
        `CardAPI: blocked WS command "${command}" — not in allowlist`
      );
      return;
    }

    WebSocketManagerInstance.Send({ command, data });
  }
}

// ─── PropertiesManager (global, non-sandboxed) ───────────────────────────────

/**
 * Global property manager registered as the "Properties" ClientMediator panel.
 * Handles property operations on behalf of any non-addon application code.
 *
 * Unlike CardAPI (per-card, sandboxed), PropertiesManager operates across any
 * parentId and maintains a shared cache for the entire session.
 */
class PropertiesManager {
  panel = "Properties";
  id = "PropertiesHelper";

  _propertyCache = {};

  constructor() {
    WebSocketManagerInstance.Subscribe("PropertiesManager_subs", (command) => {
      if (command.command === "property_update" || command.command === "property_add") {
        this._propertyCache[command.data.id] = command.data;
      }
      if (command.command === "property_delete") {
        delete this._propertyCache[command.data];
      }
    });
  }

  async Get({ parentId, isCommand }) {
    if (isCommand && !parentId) return "--parentId is required";

    const properties = await WebHelper.getAsync(
      `properties/QueryProperties?parentIds=${parentId}`
    );
    properties?.forEach((x) => { this._propertyCache[x.id] = x; });
    return properties;
  }

  async GetProperties({ parentId, isCommand }) {
    if (isCommand && !parentId) return "--parentId is required";

    const properties = await WebHelper.getAsync(
      `properties/QueryProperties?parentIds=${parentId}`
    );
    properties?.forEach((x) => { this._propertyCache[x.id] = x; });
    return properties ?? [];
  }

  async AddToCache({ properties, isCommand }) {
    if (isCommand && !properties) {
      return "--properties is required, since its complex object type this command is not supported (for now)";
    }
    properties.forEach((x) => { this._propertyCache[x.id] = x; });
  }

  async LoadToCache({ parentId, isCommand }) {
    if (isCommand && !parentId) return "--parentId is required";

    const properties = await WebHelper.getAsync(
      `properties/QueryProperties?parentIds=${parentId}`
    );
    properties?.forEach((x) => { this._propertyCache[x.id] = x; });
  }

  async GetByNames({ parentId, names, isCommand }) {
    if (isCommand && (!parentId || !names)) {
      return "--parentId and --names are required";
    }
    if (!parentId) {
      console.error("PropertiesManager.GetByNames: parentId is required");
      return [];
    }

    const namesArr = Array.isArray(names) ? names : names.split(",");

    const cached = [];
    namesArr.forEach((name) => {
      const found = Object.values(this._propertyCache).find(
        (x) => x.name === name && x.parentId === parentId
      );
      if (found) cached.push(found);
    });

    if (cached.length === namesArr.length) return cached;

    const missing = namesArr.filter((n) => !cached.find((c) => c.name === n));
    const fetched = await WebHelper.getAsync(
      `properties/QueryProperties?parentIds=${parentId}&names=${missing.join(",")}`
    );
    fetched?.forEach((x) => { this._propertyCache[x.id] = x; });

    return [...cached, ...(fetched ?? [])];
  }

  async GetByPrefix({ parentId, prefix, getFromCache, isCommand }) {
    if (isCommand && !parentId) return "--parentId is required";

    if (getFromCache) {
      return Object.values(this._propertyCache).filter(
        (x) => x.parentID === parentId && x.name.startsWith(prefix)
      );
    }

    const properties = await WebHelper.getAsync(
      `properties/QueryProperties?parentIds=${parentId}&prefix=${prefix}`
    );
    properties?.forEach((x) => { this._propertyCache[x.id] = x; });
    return properties;
  }

  async GetByIds({ parentId, ids, isCommand }) {
    if (isCommand && (!parentId || !ids)) {
      return "--parentId and --ids are required";
    }

    const idsArr = Array.isArray(ids) ? ids : ids.split(",");

    const cached = idsArr
      .filter((id) => this._propertyCache[id])
      .map((id) => this._propertyCache[id]);

    if (cached.length === idsArr.length) return cached;

    const missing = idsArr.filter((id) => !this._propertyCache[id]);
    const fetched = await WebHelper.getAsync(
      `properties/QueryProperties?parentIds=${parentId}&ids=${missing.join(",")}`
    );
    fetched?.forEach((x) => { this._propertyCache[x.id] = x; });

    return [...cached, ...(fetched ?? [])];
  }

  async Update({ property, isCommand, propertyName, propertyValue, propertyId, parentId }) {
    if (isCommand && (!propertyId || (!propertyName && !parentId))) {
      return "either --propertyId or --propertyName and --parentId are required";
    }

    let finalProperty = property;
    if (!finalProperty) {
      if (propertyId === undefined) {
        const found = await this.GetByNames({ parentId, names: propertyName });
        finalProperty = Array.isArray(found) ? found[0] : found;
      } else {
        finalProperty = { id: propertyId };
      }
      finalProperty = { ...finalProperty, value: propertyValue };
    }

    WebSocketManagerInstance.Send({ command: "property_update", data: finalProperty });
  }

  async UpdateBulk({ properties, isCommand }) {
    if (isCommand && !properties) {
      return "--properties is required, since its complex object type this command is not supported (for now)";
    }

    await WebHelper.postAsync(`properties/UpdateBulk`, properties);
    properties.forEach((x) => { this._propertyCache[x.id] = x; });
    WebSocketManagerInstance.Send({
      command: "property_notify",
      data: { id: properties[0]?.parentID },
    });
  }

  async Add({ property, isCommand, parentId, name, value, entityName }) {
    if (isCommand && (!parentId || !name || !value || !entityName)) {
      return "--parentId --name --value and --entityType are required";
    }

    if (isCommand) {
      property = { parentId, name, value, entityName };
    }

    WebSocketManagerInstance.Send({ command: "property_add", data: property });
  }

  async AddMany({ properties, isCommand }) {
    if (isCommand && !properties) {
      return "--properties is required, since its complex object type this command is not supported (for now)";
    }

    await WebHelper.postAsync(`properties/AddMany`, properties);
    properties.forEach((x) => { this._propertyCache[x.id] = x; });
    WebSocketManagerInstance.Send({ command: "property_notify" });
  }

  async Remove({ propertyId, isCommand }) {
    if (isCommand && !propertyId) return "--propertyId is required";

    delete this._propertyCache[propertyId];
    WebSocketManagerInstance.Send({ command: "property_delete", data: propertyId });
  }
}

export const PropertiesManagerInstance = new PropertiesManager();

// ─── CardAPI factory ──────────────────────────────────────────────────────────

export default async (cardId) => {
  const api = new CardAPI(cardId);
  await api.InitApi();
  return api;
};