import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import BasePanel from "../../../uiComponents/base/BasePanel";
import useBMName from "../../../uiComponents/hooks/useBattleMapName";
import DListItem from "../../../uiComponents/base/List/DListItem";
import {
  FaBorderNone,
  FaBox,
  FaChess,
  FaCircle,
  FaDotCircle,
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
import { AddShapeOptions } from "./AddShapeOptions";
import { MdTextFields } from "react-icons/md";
import { AddCircleOptions } from "./AddCircleOptions";
import { AddTextOptions } from "./AddTextOptions";
import { DrawOptions } from "./DrawOptions";
import { MeasureOptions } from "./MeasureOptions";
import { Box, For, Separator } from "@chakra-ui/react";
import { DWrapItem } from "../../../uiComponents/base/DWrapItem";

export const ToolsPanel = ({ battleMapId }) => {
  const panelRef = React.useRef(null);
  const { width, height } = useDimensions(panelRef);
  const [drag, setDrag] = React.useState(false);
  const [mode, setMode] = React.useState(undefined);
  const [layer, setLayer] = React.useState(undefined);
  const [alignMode, setAlign] = React.useState(undefined);
  const [_battleMapId, set_battleMapId] = React.useState(battleMapId);
  const [playerColor, setPlayerColor] = React.useState("rgba(0,0,0,1)");

  const colorRef = React.useRef(playerColor);

  const config = [
    { type: "label", name: "Select", ignoreAsSeparator: true },
    {
      type: "option",
      icon: <FaMousePointer />,
      name: "Select",
      onClick: () => handleDragMode(false),
      selected: !drag,
    },
    {
      type: "option",
      icon: <FaHandPaper />,
      name: "Drag",
      onClick: () => handleDragMode(true),
      selected: drag,
      enabled: !mode || mode === "_",
    },
    { type: "label", name: "Layer" },
    {
      type: "option",
      icon: <FaChess />,
      name: "Token",
      onClick: () => handleLayer(100),
      selected: layer === 100,
    },
    {
      type: "option",
      icon: <FaMap />,
      name: "Map",
      onClick: () => handleLayer(-100, true),
      selected: layer === -100,
    },
    { type: "label", name: "Draw" },
    {
      type: "option",
      icon: <FaSquare />,
      name: "Rectangle",
      onClick: () => handleRect(),
      selected: mode === "SimpleCreate_Rectangle",
    },
    {
      type: "option",
      icon: <FaCircle />,
      name: "Circle",
      onClick: () => handleCircle(),
      selected: mode === "SimpleCreate_Circle",
    },
    {
      type: "option",
      icon: <MdTextFields />,
      name: "Text",
      onClick: () => handleText(),
      selected: mode === "SimpleCreate_Text",
    },
    {
      type: "option",
      icon: <FaPaintBrush />,
      name: "Paint",
      onClick: () => handleFreeDraw(),
      selected: mode === "Draw_undefined",
    },
    { type: "label", name: "Measure" },
    {
      type: "option",
      icon: <FaRuler />,
      name: "Line",
      onClick: () => handleMeasureLine(),
      selected: mode === "Measure_Line",
    },
    { type: "label", name: "Align" },
    {
      type: "option",
      icon: <FaSquare />,
      name: "Corners",
      onClick: () => handleAlign("corners"),
      selected: alignMode === "corners",
    },
    {
      type: "option",
      icon: <FaDotCircle />,
      name: "Center",
      onClick: () => handleAlign("center"),
      selected: alignMode === "center",
    },
    {
      type: "option",
      icon: <FaBorderNone />,
      name: "None",
      onClick: () => handleAlign("none"),
      selected: alignMode === "none",
    },
  ];

  const ctx = Dockable.useContentContext();
  ctx.setPreferredSize(300, 800);
  let name = useBMName(_battleMapId);
  ctx.setTitle(`Tools - ` + name);

  const handleDragMode = (mode) => {
    ClientMediator.sendCommand("BattleMap", "SetDragMode", {
      contextId: _battleMapId,
      enabled: mode,
    });
  };

  const handleLayer = (layerId, withEditMode = false) => {
    ClientMediator.sendCommand("BattleMap", "SetSelectedLayer", {
      contextId: _battleMapId,
      layerId,
      withEditMode,
    });
  };

  const sendCreateMode = (element, sizing, type, overlayOptionsRender) => {
    ClientMediator.sendCommandAsync("BattleMap", "SetSimpleCreateMode", {
      contextId: _battleMapId,
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
        contextId: _battleMapId,
      });
    }
  };

  const handleRect = () => {
    if (mode === "SimpleCreate_Rectangle") {
      clearMode();
      return;
    }

    clearMode();
    const obj = new fabric.Rect({
      fill: playerColor,
      stroke: "rgba(0,0,0,1)",
      width: 21,
      height: 21,
    });

    sendCreateMode(obj, true, "Rectangle", () => (
      <AddShapeOptions key={mode} battleMapId={_battleMapId} />
    ));
  };

  const handleCircle = () => {
    if (mode === "SimpleCreate_Circle") {
      clearMode();
      return;
    }

    clearMode();
    const obj = new fabric.Circle({
      fill: playerColor,
      stroke: "rgba(0,0,0,1)",
      width: 100,
      height: 100,
      radius: 100,
    });
    sendCreateMode(obj, false, "Circle", () => (
      <AddCircleOptions key={mode} battleMapId={_battleMapId} />
    ));
  };

  const handleText = () => {
    if (mode === "SimpleCreate_Text") {
      clearMode();
      return;
    }

    clearMode();
    const obj = new fabric.IText("Text", {
      fill: playerColor,
      stroke: "rgba(0,0,0,1)",
      text: "Text",
    });
    sendCreateMode(obj, false, "Text", () => (
      <AddTextOptions key={mode} battleMapId={_battleMapId} />
    ));
  };

  const handleFreeDraw = () => {
    if (mode === "Draw_undefined") {
      clearMode();
      return;
    }

    clearMode();

    const brush = new fabric.PencilBrush();
    brush.color = playerColor;
    brush.width = 5;

    ClientMediator.sendCommand("BattleMap", "SetFreeDrawMode", {
      contextId: _battleMapId,
      overlayContent: <DrawOptions key={mode} battleMapId={_battleMapId} />,
      enabled: true,
      brush: brush,
    });
  };

  const handleAlign = (mode) => {
    ClientMediator.sendCommand("BattleMap", "SetAlign", {
      contextId: _battleMapId,
      align: mode,
    });
    setAlign(mode);
  };

  const updateTools = async () => {
    if (!_battleMapId) {
      var bmId = await ClientMediator.sendCommandWaitForRegisterAsync("Game", "GetActiveBattleMapId");
      set_battleMapId(bmId);
      return;
    }

    // Register changes on
    const uuid = UtilityHelper.GenerateUUID();

    const dragMode = ClientMediator.sendCommand("BattleMap", "GetDragMode", {
      contextId: _battleMapId,
    });

    setDrag(dragMode);

    // get mode and mode type
    const mode = ClientMediator.sendCommand("BattleMap", "GetCurrentMode", {
      contextId: _battleMapId,
    });

    const modeType = ClientMediator.sendCommand(
      "BattleMap",
      "GetCurrentModeType",
      {
        contextId: _battleMapId,
      }
    );

    setLayer(
      ClientMediator.sendCommand("BattleMap", "GetSelectedLayer", {
        contextId: _battleMapId,
      })
    );

    const align = ClientMediator.sendCommand("BattleMap", "GetAlign", {
      contextId: _battleMapId,
    });
    setAlign(align);

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
        if (event === "ActivePanelChanged") {
          if (data.panel !== "BattleMap" || data.contextId === _battleMapId) {
            return;
          }

          set_battleMapId(data.contextId);

          ClientMediator.unregister(uuid);
        }

        if (
          data.battleMapId === undefined ||
          data.battleMapId !== _battleMapId
        ) {
          return;
        }
        if (event === "BattleMap_DragModeChanged") {
          setDrag(data.enabled);
        }
        if (event === "BattleMap_ModeChanged") {
          if (data.mode === undefined && data.type === undefined)
            setMode(undefined);
          else {
            setMode(data.mode + "_" + data.type);
          }
        }
        if (event === "BattleMap_LayerChanged") {
          setLayer(data.layer);
        }
        if (event === "BattleMap_AlignChanged") {
          setAlign(data.align);
        }
        if (event === "BattleMapsChanged") {
          set_battleMapId(data.battleMapId);
        }
      },
    });
  }

  React.useEffect(() => {
    updateTools();
    return () => {
      ClientMediator.unregister("ToolsPanel" + _battleMapId);
    };
  }, [_battleMapId]);

  const wrapOptionDefinition = (icon, name, onClick, selected, enabled) => {
    return (
      <DWrapItem
        isSelected={selected}
        justifyContent={"center"}
        flexWrap={"wrap"}
        tooltip={name}
        opacity={enabled ? 1 : 0.5}
        onClick={onClick}
        key={"Tools_" + _battleMapId + "_" + name + enabled}
      >
        {icon}
      </DWrapItem>
    );
  };

  const optionDefinition = (icon, name, onClick, selected, enabled) => {
    return (
      <DListItem
        isSelected={selected}
        flexProps={{ gap: "10px" }}
        withHover
        justifyContent={"center"}
        onClick={onClick}
        opacity={enabled ? 1 : 0.5}
        key={"Tools_" + _battleMapId + "_" + name + enabled}
      >
        {icon}
        {name}
      </DListItem>
    );
  };

  const handleMeasureLine = () => {
    if (mode === "Measure_undefined") {
      clearMode();
      return;
    }
    clearMode();

    ClientMediator.sendCommand("BattleMap", "SetMeasureMode", {
      contextId: _battleMapId,
      enabled: true,
      playerColor: playerColor,
      overlayContent: <MeasureOptions key={mode} battleMapId={_battleMapId} />,
    });
  };

  // List

  let items = undefined;

  if (width > 150 && height > 200) {
    items = (
      <For each={config}>
        {(item) => {
          if (item.type === "label") {
            return <DLabel>{item.name}</DLabel>;
          } else {
            let enabled = item.enabled !== undefined ? item.enabled : true;
            if(!_battleMapId)
            {
              enabled = false;
            }


            return optionDefinition(
              item.icon,
              item.name,
              item.onClick,
              item.selected,
              enabled
            );
          }
        }}
      </For>
    );
  } else {
    items = (
      <Box display={"flex"} flexWrap={"wrap"} flexDir={"column"}>
        <For each={config}>
          {(item) => {
            if (item.type === "label") {
              if (item.ignoreAsSeparator) {
                return undefined;
              }
              let additionalProps = {
                marginTop: "10px",
                marginBottom: "10px",
                orientation: "horizontal",
              };
              if (height < 200 && width > 200) {
                additionalProps = {
                  marginLeft: "10px",
                  marginRight: "10px",
                  orientation: "vertical",
                };
              }

              return <Separator size={"lg"} {...additionalProps} />;
            } else {
              let enabled = item.enabled !== undefined ? item.enabled : true;
              if(!_battleMapId)
              {
                enabled = false;
              }

              return wrapOptionDefinition(
                item.icon,
                item.name,
                item.onClick,
                item.selected,
                enabled
              );
            }
          }}
        </For>
      </Box>
    );
  }

  return (
    <BasePanel
      key={"Tools_" + _battleMapId}
      direction={height > 200 ? "column" : "row"}
      baseRef={panelRef}
    >
      {items}
    </BasePanel>
  );
};
export default ToolsPanel;
