import * as React from 'react';
import { PERM } from '../components/BattleMap/Helpers/permissionBits';

export const ROLES = {
  ADMIN: 'admin',
  GM: 'gm',
  PLAYER: 'player',
};

// Hierarchy: ADMIN > GM > PLAYER
const ROLE_RANK = {
  [ROLES.ADMIN]: 2,
  [ROLES.GM]: 1,
  [ROLES.PLAYER]: 0,
};

/**
 * Module-level ref populated by PermissionsProvider.
 * Allows non-React code (useGameInitialization, BMService behaviors, etc.)
 * to push entity permission updates into React state without needing the hook.
 *
 * Usage:  _entityPermissionSetter.current?.(entityType, entityId, bits)
 */
export const _entityPermissionSetter = { current: null };

const PermissionsContext = React.createContext({
  currentRole: ROLES.PLAYER,
  isAdmin: false,
  isGM: false,
  isPlayer: true,
  hasRole: () => false,
  // entity-level
  setEntityPermission: () => {},
  getEntityPermission: () => PERM.NONE,
  hasEntityPermission: () => false,
});

/**
 * Wraps game content and provides permissions to all child components.
 *
 * Role derivation (frontend-only):
 *   ADMIN  — REACT_APP_MODE !== 'player' (GM server binary)
 *   GM     — current player owns the game (player.id === game.master.id)
 *   PLAYER — everyone else
 *
 * Entity permissions are loaded async after game/map init and stored in
 * entityPermissions state.  GMs/Admins always receive PERM.ALL.
 */
export const PermissionsProvider = ({ isGM, children }) => {
  const isAdmin = process.env.REACT_APP_MODE !== 'player';

  const currentRole = isAdmin
    ? ROLES.ADMIN
    : isGM
    ? ROLES.GM
    : ROLES.PLAYER;

  const hasRole = React.useCallback(
    (requiredRole) => ROLE_RANK[currentRole] >= ROLE_RANK[requiredRole],
    [currentRole],
  );

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

  const getEntityPermission = React.useCallback(
    (entityType, entityId) => {
      if (isAdmin || isGM) return PERM.ALL;
      return entityPermissions[`${entityType}:${entityId}`] ?? PERM.NONE;
    },
    [isAdmin, isGM, entityPermissions],
  );

  const hasEntityPermission = React.useCallback(
    (entityType, entityId, requiredBits) => {
      if (isAdmin || isGM) return true;
      if (requiredBits === PERM.NONE) return true;
      const bits = entityPermissions[`${entityType}:${entityId}`] ?? PERM.NONE;
      return (bits & requiredBits) === requiredBits;
    },
    [isAdmin, isGM, entityPermissions],
  );

  // ── Context value ───────────────────────────────────────────────────────
  const value = React.useMemo(
    () => ({
      currentRole,
      isAdmin,
      isGM: isAdmin || isGM,
      isPlayer: currentRole === ROLES.PLAYER,
      hasRole,
      setEntityPermission,
      getEntityPermission,
      hasEntityPermission,
    }),
    [currentRole, isAdmin, isGM, hasRole, setEntityPermission, getEntityPermission, hasEntityPermission],
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
