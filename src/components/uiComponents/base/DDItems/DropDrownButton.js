import { Box, Button, Icon } from "@chakra-ui/react";
import * as React from "react";
import { IoMdArrowDropdown } from "@react-icons/all-files/io/IoMdArrowDropdown";
import { usePermissions } from "../../../../contexts/PermissionsContext";

export const DropDownButton = ({
  accessKey,
  name,
  icon,
  onClick,
  width,
  height,
  requiresEdit,
}) => {
  const { canEditGame } = usePermissions();
  if (requiresEdit && !canEditGame) return null;

  return (
    <Button
      size="xs"
      borderRadius={0}
      width={width}
      height={height}
      variant="outline"
      onClick={onClick}> {icon} {name}
    </Button>
  );
};
export default DropDownButton;
