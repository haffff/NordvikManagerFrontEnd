import { Flex, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import DListItemButton from "../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import { IoMdClose } from "@react-icons/all-files/io/IoMdClose";
import { IoMdExit } from "@react-icons/all-files/io/IoMdExit";
import ClientMediator from "../../../../ClientMediator";
import { MdOutlineFormatColorFill } from "../../../uiComponents/icons/extraIcons";
import { MdBorderColor } from "@react-icons/all-files/md/MdBorderColor";
import { DColorPicker } from "../../../uiComponents/settingsComponents/ColorPicker";

export const AddTextOptions = ({ battleMapId }) => {
  const [fillColor, setFillColor] = useState("rgba(0,0,0,1)");
  const [strokeColor, setStrokeColor] = useState("rgba(0,0,0,1)");
  const [fontColor, setFontColor] = useState("rgba(0,0,0,1)");
  //const [font, setFont] = useState("Arial");

  useEffect(() => {
    let element = ClientMediator.sendCommand("BattleMap", "GetCreateElement", {
      contextId: battleMapId,
    });
    if (element) {
      setFillColor(element.fill);
      setStrokeColor(element.stroke);
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
          minimal={true}
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
          minimal={true}
          onValueChange={(color) => {
            handleUpdate("stroke", color);
            setStrokeColor(color);
          }}
          initColor={strokeColor}
          isAbsolute={true}
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
