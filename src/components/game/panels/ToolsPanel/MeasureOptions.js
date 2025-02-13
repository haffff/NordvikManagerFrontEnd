import { Flex, IconButton, Input, Stack, Text } from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import DListItemButton from "../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import { IoMdClose, IoMdExit } from "react-icons/io";
import ClientMediator from "../../../../ClientMediator";
import { MdCircle, MdLineWeight, MdTextIncrease } from "react-icons/md";
import { MdOutlineFormatColorFill } from "react-icons/md";
import { MdBorderColor } from "react-icons/md";
import { FaClock, FaCogs, FaEye, FaTimes, FaTrash } from "react-icons/fa";
import DList from "../../../uiComponents/base/List/DList";
import DListItemToggleButton from "../../../uiComponents/base/List/ListItemDetails/DListItemToggleButton";

export const MeasureOptions = ({ battleMapId }) => {
  const [visibleToOthers, setVisibleToOthers] = useState(false);
  const [dissappearAfter, setDissappearAfter] = useState(0);

  const measureRef = React.useRef();

  useEffect(() => {
    let measure = ClientMediator.sendCommand("BattleMap", "GetMeasureOptions", {
      contextId: battleMapId,
    });
    if (measure) {
      setVisibleToOthers(measure.visibleToOthers);
      setDissappearAfter(measure.dissappearAfter);
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
          if(visibleToOthers){
            ClientMediator.sendCommand("BattleMap", "CleanPreviews", {contextId: battleMapId});
          }
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
          ClientMediator.sendCommand("BattleMap", "CleanPreviews", {contextId: battleMapId});
        }}
        label={"Don't dissapear"}
        icon={FaClock}
      />
      { dissappearAfter && <DListItemButton style={{position:"absolute", top: 65, left: 65}} color={'red'} bgColor={'rgba(0,0,0,0.5)'} variant={'elevated'}  label={"Clean"} icon={FaTrash} />}
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
