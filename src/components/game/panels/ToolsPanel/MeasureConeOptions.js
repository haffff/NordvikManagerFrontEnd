import { Flex, Input, Stack, Text } from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import DListItemButton from "../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import DListItemToggleButton from "../../../uiComponents/base/List/ListItemDetails/DListItemToggleButton";
import { IoMdClose } from "react-icons/io";
import { FaClock, FaEye, FaTrash } from "react-icons/fa";
import ClientMediator from "../../../../ClientMediator";

export const MeasureConeOptions = ({ battleMapId }) => {
  const [visibleToOthers, setVisibleToOthers] = useState(false);
  const [dissappearAfter, setDissappearAfter] = useState(false);
  const [coneAngle, setConeAngle] = useState(53);

  const measureRef = React.useRef();

  useEffect(() => {
    const measure = ClientMediator.sendCommand("BattleMap", "GetMeasureOptions", {
      contextId: battleMapId,
    });
    if (measure) {
      setVisibleToOthers(measure.visibleToOthers);
      setDissappearAfter(measure.dissappearAfter);
      if (measure.coneAngle !== undefined) setConeAngle(measure.coneAngle);
      measureRef.current = measure;
    }
  }, []);

  const handleUpdate = (name, value) => {
    measureRef.current[name] = value;
  };

  return (
    <Flex gap={"10px"} direction={"row"} alignItems={"flex-start"}>
      <DListItemToggleButton
        isToggled={visibleToOthers}
        selectedColor={"gold"}
        selectedBgColor={"rgba(50,50,50,0.5)"}
        onClick={() => {
          if (visibleToOthers) {
            ClientMediator.sendCommand("BattleMap", "CleanPreviews", { contextId: battleMapId });
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
          ClientMediator.sendCommand("BattleMap", "CleanPreviews", { contextId: battleMapId });
        }}
        label={"Don't disappear"}
        icon={FaClock}
      />
      {dissappearAfter && (
        <DListItemButton
          color={"red"}
          bgColor={"rgba(0,0,0,0.5)"}
          variant={"elevated"}
          label={"Clean"}
          icon={FaTrash}
          onClick={() => {
            ClientMediator.sendCommand("BattleMap", "CleanPreviews", { contextId: battleMapId });
          }}
        />
      )}
      <Stack alignItems={"center"} gap={"4px"}>
        <Text fontSize={"xs"}>Angle °</Text>
        <Input
          boxSize={"50px"}
          variant={"outline"}
          value={coneAngle}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            if (isNaN(v) || v <= 0 || v >= 360) return;
            setConeAngle(v);
            handleUpdate("coneAngle", v);
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
