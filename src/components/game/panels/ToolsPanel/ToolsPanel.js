import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import BasePanel from "../../../uiComponents/base/BasePanel";
import useBMName from "../../../uiComponents/hooks/useBattleMapName";
import DListItem from "../../../uiComponents/base/List/DListItem";
import {
  FaChess,
  FaCircle,
  FaDragon,
  FaHandPaper,
  FaMap,
  FaMousePointer,
} from "react-icons/fa";
import DContainer from "../../../uiComponents/base/Containers/DContainer";
import ClientMediator from "../../../../ClientMediator";
import UtilityHelper from "../../../../helpers/UtilityHelper";
import DLabel from "../../../uiComponents/base/Text/DLabel";
import { useDimensions } from "../../../uiComponents/hooks/useDimensions";
import { fabric } from "fabric";

export const ToolsPanel = ({ battleMapId }) => {
  const panelRef = React.useRef(null);
  const { width, height } = useDimensions(panelRef);
  const [drag, setDrag] = React.useState(false);

  const ctx = Dockable.useContentContext();
  let name = useBMName(battleMapId);
  ctx.setTitle(`Tools - ` + name);

  const handleDragMode = (mode) => {
    ClientMediator.sendCommand("BattleMap", "SetDragMode", {
      contextId: battleMapId,
      enabled: mode,
    });
  };

  const handleLayer = (layerId, withEditMode = false) => {
    ClientMediator.sendCommand("BattleMap", "SetSelectedLayer", {
      contextId: battleMapId,
      layerId,
      withEditMode,
    });
  };

  const handleCircle = () => {
    const obj = new fabric.Rect({
        fill: "rgba(0,0,0,1)",
        stroke: "rgba(0,0,0,1)",
        width: 100,
        height: 100,
    });

    ClientMediator.sendCommandAsync("BattleMap", "SetSimpleCreateMode", {
        contextId: battleMapId,
        enabled: true,
        element: obj,
        withSizing: true,
    });
  };

  React.useEffect(() => {
    const uuid = UtilityHelper.GenerateUUID();
    const name = "ToolsPanel" + uuid;

    const dragMode = ClientMediator.sendCommand("BattleMap", "GetDragMode", {
      contextId: battleMapId,
    });
    setDrag(dragMode);

    ClientMediator.register({
      panel: "ToolsPanel",
      id: "ToolsPanel" + uuid,
      onEvent: (event, data) => {
        if (event === "BattleMap_DragModeChanged") {
          setDrag(data.enabled);
        }
      },
    });
  }, []);
  console.log(width);
  const optionDefinition = (icon, name, onClick, selected) => {
    return (
      <DListItem
        isSelected={selected}
        flexProps={{ gap: "10px" }}
        withHover
        onClick={onClick}
      >
        {icon}
        {width > 100 ? name : ""}
      </DListItem>
    );
  };

  return (
    <BasePanel baseRef={panelRef}>
      <DLabel>Select</DLabel>
      {optionDefinition(
        <FaMousePointer />,
        "Select",
        () => handleDragMode(false),
        !drag
      )}
      {optionDefinition(
        <FaHandPaper />,
        "Drag",
        () => handleDragMode(true),
        drag
      )}
      <DLabel>Layer</DLabel>
      {optionDefinition(<FaChess />, "Token", () => handleLayer(100), false)}
      {optionDefinition(<FaMap />, "Map", () => handleLayer(-100, true), false)}
      <DLabel>Shape</DLabel>
      {optionDefinition(<FaCircle />, "Circle", () => handleCircle(), false)}
    </BasePanel>
  );
};
export default ToolsPanel;
