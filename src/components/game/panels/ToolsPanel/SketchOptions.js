import { Flex, Input, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import DListItemButton from "../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import DListItemToggleButton from "../../../uiComponents/base/List/ListItemDetails/DListItemToggleButton";
import { IoMdClose } from "react-icons/io";
import { FaEye, FaTrash, FaUndo, FaUsersSlash } from "react-icons/fa";
import ClientMediator from "../../../../ClientMediator";
import { MdBrush, MdLineWeight } from "react-icons/md";
import { DColorPicker } from "../../../uiComponents/settingsComponents/ColorPicker";

/**
 * Options of Tools → Sketch: freehand marks anyone can draw, shown to the others but
 * never saved — a reload, or joining later, starts with none.
 */
export const SketchOptions = ({ battleMapId }) => {
  const [color, setColor] = useState("rgba(0,0,0,1)");
  const [width, setWidth] = useState(3);
  const [visibleToOthers, setVisibleToOthers] = useState(true);
  const isGM = !!ClientMediator.sendCommand("Game", "GetIsGM");

  const send = (command, data = {}) =>
    ClientMediator.sendCommand("BattleMap", command, { contextId: battleMapId, ...data });

  useEffect(() => {
    const brush = send("GetBrush");
    if (brush) {
      setColor(brush.color);
      setWidth(brush.width);
    }
    const options = send("GetSketchOptions");
    if (options) setVisibleToOthers(options.visibleToOthers);
  }, []);

  const updateBrush = (name, value) => {
    const brush = send("GetBrush");
    if (brush) brush[name] = value;
  };

  return (
    <Flex gap={"10px"} direction={"row"} title="Sketches are shown to everyone on this map but never saved: a reload, or joining later, starts without them.">
      <Stack alignItems={"center"}>
        <Text>
          <MdBrush />
        </Text>
        <DColorPicker
          minimal={true}
          onValueChange={(value) => {
            updateBrush("color", value);
            setColor(value);
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
            updateBrush("width", Number(e.target.value));
            setWidth(e.target.value);
          }}
        />
      </Stack>
      <DListItemToggleButton
        isToggled={visibleToOthers}
        selectedColor={"gold"}
        selectedBgColor={"rgba(50,50,50,0.5)"}
        onClick={() => {
          const options = send("GetSketchOptions");
          if (options) options.visibleToOthers = !visibleToOthers;
          setVisibleToOthers(!visibleToOthers);
        }}
        label={"Visible to others"}
        icon={FaEye}
      />
      <DListItemButton label={"Undo"} icon={FaUndo} variant={"elevated"} onClick={() => send("UndoSketch")} />
      <DListItemButton label={"Clean"} icon={FaTrash} color={"red"} variant={"elevated"} onClick={() => send("CleanSketches")} />
      {isGM && (
        <DListItemButton
          label={"Clear everyone's"}
          icon={FaUsersSlash}
          color={"red"}
          variant={"elevated"}
          onClick={() => send("CleanSketches", { everyone: true })}
        />
      )}
      <DListItemButton
        label={"Exit"}
        icon={IoMdClose}
        color={"red"}
        variant={"elevated"}
        onClick={() => send("SetFreeDrawMode", { enabled: false })}
      />
    </Flex>
  );
};
