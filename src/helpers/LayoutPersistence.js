/**
 * Per-player, per-game dockable-layout persistence in localStorage.
 *
 * Used by LayoutAutoSaveManager + useGameInitialization when the GM enables the
 * per-game "saveLayoutOnExit" toggle. Storage is per-browser — a server-side
 * per-player LayoutModel (restricted via permissions) is the portable upgrade.
 *
 * Every function is defensive: localStorage can be unavailable (private mode),
 * throw on write (quota), or hold a payload from an incompatible build. Nothing
 * here ever throws to its caller.
 */

// Bump whenever LayoutCloneHelper's serialization shape or PanelsList keys change,
// so a new deploy discards blobs it can't safely rehydrate.
const SCHEMA = 1;

const key = (gameId, playerId) => `nm_layout_${gameId}_${playerId}`;

export const LayoutPersistence = {
  SCHEMA,

  save(gameId, playerId, cloneObj) {
    if (!gameId || !playerId || !cloneObj) return;
    try {
      localStorage.setItem(
        key(gameId, playerId),
        JSON.stringify({
          schema: SCHEMA,
          savedAt: Date.now(),
          build: process.env.REACT_APP_BUILD_ID ?? null,
          layout: cloneObj,
        })
      );
    } catch (e) {
      console.warn("[LayoutPersistence] save failed (quota / unavailable)", e?.message ?? e);
    }
  },

  /** Returns the saved clone object, or null if absent / unreadable / stale schema. */
  load(gameId, playerId) {
    if (!gameId || !playerId) return null;
    let raw;
    try {
      raw = localStorage.getItem(key(gameId, playerId));
    } catch {
      return null;
    }
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.schema !== SCHEMA || !parsed.layout) {
        LayoutPersistence.clear(gameId, playerId);
        return null;
      }
      return parsed.layout;
    } catch {
      LayoutPersistence.clear(gameId, playerId);
      return null;
    }
  },

  clear(gameId, playerId) {
    if (!gameId || !playerId) return;
    try {
      localStorage.removeItem(key(gameId, playerId));
    } catch {
      /* ignore */
    }
  },
};

export default LayoutPersistence;
