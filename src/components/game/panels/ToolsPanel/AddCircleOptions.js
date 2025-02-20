import { Box, Flex, Input, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import DListItemButton from "../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import { IoMdClose, IoMdExit } from "react-icons/io";
import ClientMediator from "../../../../ClientMediator";
import { MdCircle, MdLineWeight } from "react-icons/md";
import { MdOutlineFormatColorFill } from "react-icons/md";
import { MdBorderColor } from "react-icons/md";
import { DColorPicker } from "../../../uiComponents/settingsComponents/ColorPicker";
import { DWrapItem } from "../../../uiComponents/base/DWrapItem";

export const AddCircleOptions = ({ battleMapId }) => {
  const [fillColor, setFillColor] = useState("rgba(0,0,0,1)");
  const [strokeColor, setStrokeColor] = useState("rgba(0,0,0,1)");
  const [lineWidth, setLineWidth] = useState(1);
  const [radius, setRadius] = useState(1);
  useEffect(() => {
    let element = ClientMediator.sendCommand("BattleMap", "GetCreateElement", {
      contextId: battleMapId,
    });

    if (element) {
      setFillColor(element.fill);
      setStrokeColor(element.stroke);
      setRadius(100);
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
          minimal
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
          minimal
          onValueChange={(color) => {
            handleUpdate("stroke", color);
            setStrokeColor(color);
          }}
          initColor={strokeColor}
        />
      </Stack>
      <Stack alignItems={"center"}>
        <Text>
          <MdLineWeight />
        </Text>
        <Input
          boxSize={"40px"}
          variant={"outline"}
          value={lineWidth}
          onChange={(e) => {
            //Check if number
            if (isNaN(e.target.value) || e.target.value < 0) {
              return;
            }

            handleUpdate("strokeWidth", e.target.value);
            setLineWidth(e.target.value);
          }}
        />
      </Stack>
      <Stack alignItems={"center"}>
        <Text fontSize={"10px"}>Radius</Text>
        <Input
          type={"number"}
          width={"75px"}
          variant={"outline"}
          value={radius}
          onChange={(e) => {
            handleUpdate("radius", e.target.value);
            setRadius(e.target.value);
          }}
        />
      </Stack>
      <Stack alignItems={"center"}>
        <DWrapItem
          tooltip={"Exit"}
          boxSize={"35px"}
          padding={"1px !important"}
          color={"#ff0000"}
          backgroundColor={"rgba(0,0,0,0)"}
          onClick={() => {
            ClientMediator.sendCommand("BattleMap", "SetSimpleCreateMode", {
              contextId: battleMapId,
              enabled: false,
            });
          }}
        >
          {<IoMdClose />}
        </DWrapItem>
      </Stack>
    </Flex>
  );
};
