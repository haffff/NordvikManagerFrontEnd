import { Flex, Input, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import DListItemButton from "../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import { IoMdClose, IoMdExit } from "react-icons/io";
import ClientMediator from "../../../../ClientMediator";
import { MdLineWeight } from "react-icons/md";
import { MdOutlineFormatColorFill } from "react-icons/md";
import { MdBorderColor } from "react-icons/md";
import { DColorPicker } from "../../../uiComponents/settingsComponents/ColorPicker";

export const AddShapeOptions = ({ battleMapId }) => {
  const [fillColor, setFillColor] = useState("rgba(0,0,0,1)");
  const [strokeColor, setStrokeColor] = useState("rgba(0,0,0,1)");
  const [lineWidth, setLineWidth] = useState(1);
  useEffect(() => {
    let element = ClientMediator.sendCommand("BattleMap", "GetCreateElement", {
      contextId: battleMapId,
    });
    if (element) {
      setFillColor(element.fill);
      setStrokeColor(element.stroke);
      setLineWidth(element.strokeWidth);
    }
    return () => {};
  }, []);

  const handleUpdate = (name, value) => {
    let element = ClientMediator.sendCommand("BattleMap", "GetCreateElement", {
      contextId: battleMapId,
    });
    element[name] = value;
  };
  
  return (
    <Flex gap={"10px"} direction={"row"}>
      <Stack alignItems={"center"}>
        <Text>
          <MdOutlineFormatColorFill />
        </Text>
        <DColorPicker
          onValueChange={(color) => {
            handleUpdate("fill", color);
            setFillColor(color);
          }}
          initColor={fillColor}
        />
      </Stack>
      <Stack alignItems={"center"}>
        <Text>
          <MdBorderColor />
        </Text>
        <DColorPicker
          onValueChange={(color) => {
            handleUpdate("stroke", color);
            setStrokeColor(color);
          }}
          initColor={strokeColor}
          isAbsolute={true}
        />
      </Stack>
      <Stack alignItems={"center"}>
        <Text>
          <MdLineWeight />
        </Text>
        <Input
          type={"number"}
          width={"50px"}
          variant={"outline"}
          value={lineWidth}
          onChange={(e) => {
            handleUpdate("strokeWidth", e.target.value);
            setLineWidth(e.target.value);
          }}
        />
      </Stack>
      <Stack alignItems={"center"}>
        <DListItemButton
          label={"Exit"}
          icon={IoMdClose}
          color={"red"}
          variant={"elevated"}
          onClick={() => {
            ClientMediator.sendCommand("BattleMap", "SetSimpleCreateMode", {
              contextId: battleMapId,
              enabled: false,
            });
          }}
        />
      </Stack>
    </Flex>
  );
};
