import {
  Button,
  Center,
  Flex,
  Icon,
  IconButton,
  Stack,
  Tooltip,
} from "@chakra-ui/react";
import * as React from "react";
import { FaPlus } from "react-icons/fa";
import DListItemButton from "./DListItemButton";

export const DListItemToggleButton = ({
  label,
  style,
  onClick,
  color,
  selectedColor,
  bgColor,
  selectedBgColor,
  icon,
  margin,
  variant,
  isToggled,
}) => {
  let activeColor = isToggled ? selectedColor : color;
  let activeBgColor = isToggled ? selectedBgColor : bgColor;

  return (
    <DListItemButton
      label={label}
      onClick={onClick}
      color={activeColor}
      bgColor={activeBgColor}
      margin={margin}
      variant={variant}
      style={style}
    >
      <Icon color={activeColor || "var(--nordvik-text-color)"} as={icon} />
    </DListItemButton>
  );
};

export default DListItemToggleButton;
