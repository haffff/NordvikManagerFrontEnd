import * as React from 'react';
import { Tooltip } from '@chakra-ui/react';
import { FaLock } from 'react-icons/fa';
import { usePermissions, ROLES } from '../../../contexts/PermissionsContext';

/**
 * Renders children if the current user meets the required role.
 *
 * Props:
 *   role       — minimum required ROLES value (e.g. ROLES.GM)
 *   showLocked — if true, renders a disabled wrapper + lock icon instead of null
 *   tooltip    — custom tooltip text shown when locked (defaults to role-based message)
 */
export const PermissionGate = ({ role, showLocked = false, tooltip, children }) => {
  const { hasRole, currentRole } = usePermissions();

  if (hasRole(role)) return <>{children}</>;

  if (!showLocked) return null;

  const defaultTooltip =
    role === ROLES.ADMIN ? 'Admin only' :
    role === ROLES.GM    ? 'GM only' :
    'Access restricted';

  return (
    <Tooltip content={tooltip || defaultTooltip} positioning={{ placement: 'top' }}>
      <span style={{ opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <FaLock style={{ fontSize: '0.7em' }} />
        {children}
      </span>
    </Tooltip>
  );
};

export default PermissionGate;
