import * as React from 'react';
import { PERM, ENTITY_TYPES, canEditGame as isGameEditor } from '../components/BattleMap/Helpers/permissionBits';

/**
 * Module-level ref populated by PermissionsProvider.
 * Allows non-React code (BMService behaviors, etc.) to push entity permission updates
 * into React state without needing the hook. The game's own permission is not kept here:
 * it comes in as the provider's `gamePermission` prop (see useGameState).
 *
 * Usage:  _entityPermissionSetter.current?.(entityType, entityId, bits)
 */
export const _entityPermissionSetter = { current: null };

const PermissionsContext = React.createContext({
  isOwner: false,
  canEditGame: false,
  isLocalAdmin: false,
  // entity-level
  setEntityPermission: () => {},
  getEntityPermission: () => PERM.NONE,
  hasEntityPermission: () => false,
});

/**
 * Wraps game content and provides permissions to all child components. The UI follows
 * what the server lets the player do:
 *
 *   canEditGame  — Edit on the game (settings, addons, maps, playlists, …); the owner always can
 *   isOwner      — the player is the game's GM (whisper target, the one playback driver, game
 *                  permissions, deleting the game)
 *   isLocalAdmin — the user runs this server (linking files from its disk)
 *
 * Entity permissions are loaded async after game/map init and stored in entityPermissions
 * state. The owner and co-GMs get PERM.ALL on the game's content (the server gives co-GMs
 * the owner's rights); the game itself keeps the co-GM's own permission.
 */
export const PermissionsProvider = ({ gameId, isOwner = false, isLocalAdmin = false, gamePermission = PERM.NONE, children }) => {
  // ── Entity-level permissions ────────────────────────────────────────────
  // Key format: `${entityType}:${entityId}` → permission bits for current player
  const [entityPermissions, setEntityPermissionsState] = React.useState({});

  const setEntityPermission = React.useCallback((entityType, entityId, bits) => {
    setEntityPermissionsState((prev) => ({
      ...prev,
      [`${entityType}:${entityId}`]: bits,
    }));
  }, []);

  // Sync the module-level ref so non-React callers can push updates.
  _entityPermissionSetter.current = setEntityPermission;

  const canEditGame = isGameEditor(isOwner, gamePermission);

  const getEntityPermission = React.useCallback(
    (entityType, entityId) => {
      if (isOwner) return PERM.ALL;
      if (entityType === ENTITY_TYPES.GAME && entityId === gameId) return gamePermission ?? PERM.NONE;
      if (canEditGame) return PERM.ALL;
      return entityPermissions[`${entityType}:${entityId}`] ?? PERM.NONE;
    },
    [isOwner, gameId, gamePermission, canEditGame, entityPermissions],
  );

  const hasEntityPermission = React.useCallback(
    (entityType, entityId, requiredBits) => {
      if (requiredBits === PERM.NONE) return true;
      return (getEntityPermission(entityType, entityId) & requiredBits) === requiredBits;
    },
    [getEntityPermission],
  );

  // ── Context value ───────────────────────────────────────────────────────
  const value = React.useMemo(
    () => ({
      isOwner: !!isOwner,
      canEditGame,
      isLocalAdmin: !!isLocalAdmin,
      setEntityPermission,
      getEntityPermission,
      hasEntityPermission,
    }),
    [isOwner, canEditGame, isLocalAdmin, setEntityPermission, getEntityPermission, hasEntityPermission],
  );

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};

/** Hook for any React component to read the current user's permissions. */
export const usePermissions = () => React.useContext(PermissionsContext);

export default PermissionsContext;
