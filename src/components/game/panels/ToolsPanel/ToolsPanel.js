import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import BasePanel from "../../../uiComponents/base/BasePanel";
import useBMName from "../../../uiComponents/hooks/useBattleMapName";
import DListItem from "../../../uiComponents/base/List/DListItem";
import {
  FaChess,
  FaCircle,
  FaHandPaper,
  FaMap,
  FaMousePointer,
  FaPaintBrush,
  FaRuler,
  FaSquare,
} from "react-icons/fa";
import ClientMediator from "../../../../ClientMediator";
import UtilityHelper from "../../../../helpers/UtilityHelper";
import DLabel from "../../../uiComponents/base/Text/DLabel";
import { useDimensions } from "../../../uiComponents/hooks/useDimensions";
import { fabric } from "fabric";
import { Divider } from "@chakra-ui/react";
import { AddShapeOptions } from "./AddShapeOptions";
import { MdTextFields } from "react-icons/md";
import { AddCircleOptions } from "./AddCircleOptions";
import { AddTextOptions } from "./AddTextOptions";
import { DrawOptions } from "./DrawOptions";

export const ToolsPanel = ({ battleMapId }) => {
  const panelRef = React.useRef(null);
  const { width, height } = useDimensions(panelRef);
  const [drag, setDrag] = React.useState(false);
  const [mode, setMode] = React.useState(undefined);
  const [layer, setLayer] = React.useState(undefined);
  const [playerColor, setPlayerColor] = React.useState("rgba(0,0,0,1)");

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

  const sendCreateMode = (element, sizing, type, overlayOptionsRender) => {
    ClientMediator.sendCommandAsync("BattleMap", "SetSimpleCreateMode", {
      contextId: battleMapId,
      enabled: true,
      element: element,
      withSizing: sizing,
      overlayContent: overlayOptionsRender(),
      type: type,
    });
  };

  const clearMode = () => {
    if (mode !== "_" || mode !== undefined) {
      ClientMediator.sendCommand("BattleMap", "DisableAllModes", {
        contextId: battleMapId,
      });
    }
  };

  const handleRect = () => {
    clearMode();
    const obj = new fabric.Rect({
      fill: playerColor,
      stroke: "rgba(0,0,0,1)",
      width: 21,
      height: 21,
    });

    sendCreateMode(obj, true, "Rectangle", () => (
      <AddShapeOptions key={mode} battleMapId={battleMapId} />
    ));
  };

  const handleCircle = () => {
    clearMode();
    const obj = new fabric.Circle({
      fill: playerColor,
      stroke: "rgba(0,0,0,1)",
      width: 100,
      height: 100,
      radius: 100,
    });
    sendCreateMode(obj, false, "Circle", () => (
      <AddCircleOptions key={mode} battleMapId={battleMapId} />
    ));
  };

  const handleText = () => {
    clearMode();
    const obj = new fabric.IText("Text", {
      fill: playerColor,
      stroke: "rgba(0,0,0,1)",
      text: "Text",
    });
    sendCreateMode(obj, false, "Text", () => (
      <AddTextOptions key={mode} battleMapId={battleMapId} />
    ));
  };

  const handleFreeDraw = () => {
    clearMode();

    const brush = new fabric.PencilBrush();
    brush.color = playerColor;
    brush.width = 5;

    ClientMediator.sendCommand("BattleMap", "SetFreeDrawMode", {
      contextId: battleMapId,
      overlayContent: <DrawOptions key={mode} battleMapId={battleMapId} />,
      enabled: true,
      brush: brush,
    });
  };

  const horizontal = height < 200;
  const vertical = height > 200;

  React.useEffect(() => {
    // Register changes on
    const uuid = UtilityHelper.GenerateUUID();
    const name = "ToolsPanel" + uuid;

    const dragMode = ClientMediator.sendCommand("BattleMap", "GetDragMode", {
      contextId: battleMapId,
    });

    setDrag(dragMode);

    // get mode and mode type
    const mode = ClientMediator.sendCommand("BattleMap", "GetCurrentMode", {
      contextId: battleMapId,
    });

    const modeType = ClientMediator.sendCommand(
      "BattleMap",
      "GetCurrentModeType",
      {
        contextId: battleMapId,
      }
    );

    setLayer(
      ClientMediator.sendCommand("BattleMap", "GetSelectedLayer", {
        contextId: battleMapId,
      })
    );

    // get player color
    const playerColor = ClientMediator.sendCommand(
      "Game",
      "GetCurrentPlayerColor"
    );
    setPlayerColor(playerColor);
    setMode(mode + "_" + modeType);

    ClientMediator.register({
      panel: "ToolsPanel",
      id: "ToolsPanel" + uuid,
      onEvent: (event, data) => {
        if (event === "BattleMap_DragModeChanged") {
          setDrag(data.enabled);
        }
        if (event === "BattleMap_ModeChanged") {
          setMode(data.mode + "_" + data.type);
        }
        if (event === "BattleMap_LayerChanged") {
          setLayer(data.layer);
        }
      },
    });
  }, []);

  const optionDefinition = (icon, name, onClick, selected) => {
    return (
      <DListItem
        isSelected={selected}
        flexProps={{ gap: "10px" }}
        withHover
        justifyContent={width > 100 ? "center" : "flex-start"}
        onClick={onClick}
      >
        {icon}
        {width > 100 ? name : ""}
      </DListItem>
    );
  };

  const handleMeasureLine = () => {
    clearMode();

    let arrow = new fabric.LineArrow([0, 0, 0, 0], {
      stroke: "rgba(0,0,0,1)",
      strokeWidth: 5,
      fill: playerColor,
      selectable: false,
    });

    ClientMediator.sendCommand("BattleMap", "SetMeasureMode", {
      contextId: battleMapId,
      enabled: true,
      arrowObject: arrow,
    });
  };

  return (
    <BasePanel direction={height > 200 ? "column" : "row"} baseRef={panelRef}>
      {vertical && <DLabel>Select</DLabel>}
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
      {vertical && <DLabel>Layer</DLabel>}
      {horizontal && <Divider orientation="vertical" />}
      {optionDefinition(
        <FaChess />,
        "Token",
        () => handleLayer(100),
        layer === 100
      )}
      {optionDefinition(
        <FaMap />,
        "Map",
        () => handleLayer(-100, true),
        layer === -100
      )}
      {vertical && <DLabel>Draw</DLabel>}
      {horizontal && <Divider orientation="vertical" />}
      {optionDefinition(
        <FaSquare />,
        "Rectangle",
        () => handleRect(),
        mode === "SimpleCreate_Rectangle"
      )}
      {optionDefinition(
        <FaCircle />,
        "Circle",
        () => handleCircle(),
        mode === "SimpleCreate_Circle"
      )}
      {optionDefinition(
        <MdTextFields />,
        "Text",
        () => handleText(),
        mode === "SimpleCreate_Text"
      )}
      {optionDefinition(
        <FaPaintBrush />,
        "Paint",
        () => handleFreeDraw(),
        mode === "Draw_undefined"
      )}
      {vertical && <DLabel>Measure</DLabel>}
      {horizontal && <Divider orientation="vertical" />}
      {optionDefinition(
        <FaRuler />,
        "Line",
        () => handleMeasureLine(),
        mode === "Measure_Line"
      )}
    </BasePanel>
  );
};
export default ToolsPanel;
