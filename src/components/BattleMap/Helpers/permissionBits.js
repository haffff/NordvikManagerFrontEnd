/** Canonical permission bit constants for BattleMap elements. */
export const PERM = {
  NOT_SET: -1,   // used in UI to represent "no explicit permission set, fallback to default"
  NONE: 0,
  SEE: 1,
  EXECUTE: 2,
  CONTROL: 4,
  EDIT: 8,
  REMOVE: 16,
  ALL: 31,
};

/**
 * Cumulative permission levels — each level includes all lower permissions.
 * Use these when setting permissions via the UI so that granting e.g. CONTROL
 * also implicitly grants SEE and EXECUTE.
 *
 *   SEE     = 1        (see only)
 *   EXECUTE = 1|2  = 3
 *   CONTROL = 1|2|4 = 7
 *   EDIT    = 1|2|4|8 = 15
 *   REMOVE  = 1|2|4|8|16 = 31
 */
export const PERM_LEVEL = {
  NONE:    0,
  SEE:     PERM.SEE,                                          // 1
  EXECUTE: PERM.SEE | PERM.EXECUTE,                          // 3
  CONTROL: PERM.SEE | PERM.EXECUTE | PERM.CONTROL,           // 7
  EDIT:    PERM.SEE | PERM.EXECUTE | PERM.CONTROL | PERM.EDIT,  // 15
  REMOVE:  PERM.ALL,                                         // 31
};

/**
 * Entity type strings — must match the backend's entity type names.
 * Used as the `entityType` parameter in security/permissions API calls and
 * WebSocket permission_update messages.
 */
export const ENTITY_TYPES = {
  GAME: 'GameModel',
  MAP: 'MapModel',
  ELEMENT: 'ElementModel',
  BATTLEMAP: 'BattleMapModel',
};

export const canSee     = (bits) => (bits & 1) === 1;
export const canExecute = (bits) => (bits & 2) === 2;
export const canControl = (bits) => (bits & 4) === 4;
export const canEdit    = (bits) => (bits & 8) === 8;
export const canRemove  = (bits) => (bits & 16) === 16;

