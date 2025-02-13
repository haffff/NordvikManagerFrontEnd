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
      <Stack>
        <Text>
          <MdBrush />
        </Text>
        <DColorPicker
          onValueChange={(color) => {
            handleUpdate("color", color);
            setColor(color);
          }}
          color={color}
        />
      </Stack>
        <Stack>
            <Text>
            <MdLineWeight />
            </Text>
            <Input
            type="number"
            value={width}
            onChange={(e) => {
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
