import { Flex, IconButton, Input, Stack, Text } from "@chakra-ui/react";
import ColorPicker from "../../../uiComponents/ColorPicker";
import React, { useEffect, useState } from "react";
import DListItemButton from "../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import { IoMdClose, IoMdExit } from "react-icons/io";
import ClientMediator from "../../../../ClientMediator";
import { MdCircle, MdLineWeight, MdTextIncrease } from "react-icons/md";
import { MdOutlineFormatColorFill } from "react-icons/md";
import { MdBorderColor } from "react-icons/md";
import { FaClock, FaCogs, FaEye, FaTimes } from "react-icons/fa";
import DList from "../../../uiComponents/base/List/DList";
import DListItemToggleButton from "../../../uiComponents/base/List/ListItemDetails/DListItemToggleButton";

export const MeasureOptions = ({ battleMapId }) => {
  const [visibleToOthers, setVisibleToOthers] = useState(false);
  const [dissappearAfter, setDissappearAfter] = useState(0);
  const [advancedMode, setAdvancedMode] = useState(false);

  const measureRef = React.useRef();

  useEffect(() => {
    let measure = ClientMediator.sendCommand("BattleMap", "GetMeasureOptions", {
      contextId: battleMapId,
    });
    if (measure) {
      setVisibleToOthers(measure.visibleToOthers);
      setDissappearAfter(measure.dissappearAfter);
      setAdvancedMode(measure.advancedMode);
      measureRef.current = measure;
    }

    return () => {};
  }, []);

  const handleUpdate = (name, value) => {
    measureRef.current[name] = value;
  };

  return (
    <Flex gap={"10px"} direction={"row"}>
      <DListItemToggleButton
        isToggled={visibleToOthers}
        selectedColor={"gold"}
        selectedBgColor={"rgba(50,50,50,0.5)"}
        onClick={() => {
          setVisibleToOthers(!visibleToOthers);
          handleUpdate("visibleToOthers", !visibleToOthers);
        }}
        label={"Visible to others"}
        icon={FaEye}
      />
      <DListItemToggleButton
        isToggled={dissappearAfter}
        selectedColor={"gold"}
        selectedBgColor={"rgba(50,50,50,0.5)"}
        onClick={() => {
          setDissappearAfter(!dissappearAfter);
          handleUpdate("dissappearAfter", !dissappearAfter);
        }}
        label={"Don't dissapear"}
        icon={FaClock}
      />
      <DListItemToggleButton
        isToggled={advancedMode}
        selectedColor={"gold"}
        selectedBgColor={"rgba(50,50,50,0.5)"}
        onClick={() => {
          setAdvancedMode(!advancedMode);
          handleUpdate("advancedMode", !advancedMode);
        }}
        label={"Advanced mode"}
        icon={FaCogs}
      />
      <Stack alignItems={"center"}>
        <DListItemButton
          label={"Exit"}
          icon={IoMdClose}
          color={"red"}
          variant={"elevated"}
          onClick={() => {
            ClientMediator.sendCommand("BattleMap", "SetMeasureMode", {
              contextId: battleMapId,
              enabled: false,
            });
          }}
        />
      </Stack>
    </Flex>
  );
};
