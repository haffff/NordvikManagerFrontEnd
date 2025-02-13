import {
  Box,
  Button,
  Center,
  Flex,
  Icon,
  IconButton,
  Menu,
  Stack,
  Td,
} from "@chakra-ui/react";
import * as React from "react";
import { FaArrowLeft } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";
import { MenuItem } from "../../../../ui/menu";

export const DeletableDropDownButton = ({
  id,
  name,
  icon,
  gmOnly,
  onClick,
  onDeleteClick,
  width,
  height,
}) => {
  if (gmOnly && localStorage.getItem("gmMode") !== "true") {
    return null;
  }

  //TODO get access key from settings

  return (
    <MenuItem value={name + id} onClick={onClick}>
      <Flex justifyContent={'space-between'} alignItems={'center'} alignContent={'center'} grow={'1'} flex={'1'}>
        <p>{icon} {name}</p>
        <Button
          size="xs"
          width={'30px'}
          height={'30px'}
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteClick(e);
          }}
        >
          X
        </Button>
      </Flex>
    </MenuItem>
  );
};
export default DeletableDropDownButton;
