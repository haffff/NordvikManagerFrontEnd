import { Flex, Input, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import DListItemButton from "../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import { IoMdClose } from "react-icons/io";
import ClientMediator from "../../../../ClientMediator";
import { MdBrush, MdLineWeight } from "react-icons/md";
import { DColorPicker } from "../../../uiComponents/settingsComponents/ColorPicker";

export const DrawOptions = ({ battleMapId }) => {
  const [color, setColor] = useState("rgba(0,0,0,1)");
  const [width, setWidth] = useState(1);

  useEffect(() => {
    let element = ClientMediator.sendCommand("BattleMap", "GetBrush", {
      contextId: battleMapId,
    });
    if (element) {
      setColor(element.color);
      setWidth(element.width);
    }
    return () => {};
  }, []);

  const handleUpdate = (name, value) => {
    let element = ClientMediator.sendCommand("BattleMap", "GetBrush", {
      contextId: battleMapId,
    });
    element[name] = value;
  };

  return (
    <Flex gap={"10px"} direction={"row"}>
      <Stack alignItems={"center"}>
        <Text>
          <MdBrush />
        </Text>
        <DColorPicker
          minimal={true}
          onValueChange={(color) => {
            handleUpdate("color", color);
            setColor(color);
          }}
          initColor={color}
        />
      </Stack>
      <Stack alignItems={"center"}>
        <Text>
          <MdLineWeight />
        </Text>
        <Input
          boxSize={"40px"}
          value={width}
          onChange={(e) => {
            if (isNaN(e.target.value) || e.target.value < 0) {
              return;
            }

            handleUpdate("width", e.target.value);
            setWidth(e.target.value);
          }}
        />
      </Stack>
      <DListItemButton
        label={"Exit"}
        icon={IoMdClose}
        color={"red"}
        variant={"elevated"}
        onClick={() => {
          ClientMediator.sendCommand("BattleMap", "SetFreeDrawMode", {
            contextId: battleMapId,
            enabled: false,
          });
        }}
      />
    </Flex>
  );
};
