// The token editor's stand-in for src/helpers/transport.js: there is no game and no
// server. Pictures and SVGs are files the user picked, kept in the browser
// (toolResources); resource URLs keep the backend's shape so FabricTypesInitializer's
// image loader asks getResourceBlobAsync for them, as it does in a game.
//
// In the token editor's build (REACT_APP_MODE=tokens), vite.config.js resolves
// src/helpers/transport.js to this file.

const NO_SERVER = () => Promise.reject(new Error("There is no server in the token editor."));
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const resources = new Map();

/** Files the user picked, by the key the token file uses (tokenImage, an SVG part's src). */
export const toolResources = {
  put: (key, value) => resources.set(key, value),
  get: (key) => resources.get(key),
  remove: (key) => resources.delete(key),
  clear: () => resources.clear(),
};

const lookup = (id, key) => resources.get(key ?? id) ?? null;

export const ActiveWebHelper = {
  GameId: null,
  getResourceString(id, key) {
    return id ? `/api/Materials/Resource?id=${encodeURIComponent(id)}` : `/api/Materials/Resource?key=${encodeURIComponent(key)}`;
  },
  async getResourceBlobAsync(id, key) {
    const value = lookup(id, key);
    return value instanceof Blob ? value : null;
  },
  async getMaterialAsync(id, mimeType, key) {
    // TokenManager passes a key in the id slot when it isn't a GUID.
    return lookup(GUID.test(id ?? "") ? id : null, key ?? id);
  },
  getAsync: NO_SERVER,
  postAsync: NO_SERVER,
  deleteAsync: NO_SERVER,
};

const watchers = new Set();

export const ActiveTransportManager = {
  WebSocketStarted: true,
  WebSocketReady: true,
  Start() {},
  Close() {},
  /** Commands that would go to the server; the editor may show them. */
  Send(command) {
    if (!command) return false;
    for (const watcher of watchers) watcher(command);
    return true;
  },
  watch(watcher) {
    watchers.add(watcher);
    return () => watchers.delete(watcher);
  },
  Subscribe() {},
  Unsubscribe() {},
  isConnected: () => true,
  isChannelReady: () => true,
};
