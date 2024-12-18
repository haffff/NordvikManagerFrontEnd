import { Flex, Input, Stack, Text } from "@chakra-ui/react";
import ColorPicker from "../../../uiComponents/ColorPicker";
import { useEffect, useState } from "react";
import DListItemButton from "../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import { IoMdClose, IoMdExit } from "react-icons/io";
import ClientMediator from "../../../../ClientMediator";
import { MdCircle, MdLineWeight } from "react-icons/md";
import { MdOutlineFormatColorFill } from "react-icons/md";
import { MdBorderColor } from "react-icons/md";

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
        <ColorPicker
          onChange={(color) => {
            handleUpdate("fill", color);
            setFillColor(color);
          }}
          color={fillColor}
          isAbsolute={true}
        />
      </Stack>
      <Stack alignItems={"center"}>
        <Text>
          <MdBorderColor />
        </Text>
        <ColorPicker
          onChange={(color) => {
            handleUpdate("stroke", color);
            setStrokeColor(color);
          }}
          color={strokeColor}
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
        <Text>
          Radius
        </Text>
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
