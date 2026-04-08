import * as React from "react";

import { MenuItem } from "../../../ui/menu";
import { usePermissions } from "../../../../contexts/PermissionsContext";

export const DropDownItem = ({ accessKey, name, onClick, icon, width, gmOnly, adminOnly }) => {
  const { isGM, isAdmin } = usePermissions();
  if (gmOnly && !isGM) return null;
  if (adminOnly && !isAdmin) return null;

  // Normalize icon: accept component (function) or React element
  let renderedIcon = null;
  try {
    if (icon) {
      if (typeof icon === 'function') {
        renderedIcon = React.createElement(icon);
      } else {
        renderedIcon = icon;
      }
    }
  } catch (e) {
    renderedIcon = null;
  }

  return (
    <MenuItem value={name} width={width} onClick={onClick}>
        {renderedIcon} {name}
    </MenuItem>
  );
};
export default DropDownItem;
