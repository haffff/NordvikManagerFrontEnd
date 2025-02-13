import { Box, Button, Icon } from "@chakra-ui/react";
import * as React from "react";
import { IoMdArrowDropdown } from "react-icons/io";

export const DropDownButton = ({
  accessKey,
  name,
  icon,
  onClick,
  width,
  height,
  gmOnly,
}) => {
  if (gmOnly && localStorage.getItem("gmMode") !== "true") {
    return null;
  }

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
