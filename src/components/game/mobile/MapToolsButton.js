import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import { Box, Flex, IconButton, Text } from "@chakra-ui/react";
import { FaTools } from "@react-icons/all-files/fa/FaTools";
import { FaTimes } from "@react-icons/all-files/fa/FaTimes";
import ToolsPanel from "../panels/ToolsPanel/ToolsPanel";
import ClientMediator from "../../../ClientMediator";
import { makePanelContentContext } from "../../../helpers/panelContentContext";
import themeColors from "../../../helpers/themeColors";

const PANEL_W = 240;
const PANEL_H = 480;

// The tool a BattleMap_ModeChanged names: its type (Rectangle, Circle...) or its mode.
const modeLabel = (data) => data?.type || data?.mode || null;

/**
 * The phone's way to the map tools: a button in the battle map's corner opening the Tools
 * panel over the map. A tap, not a press on the map, so it never meets the map's gestures.
 * While a tool is on, the button says which, with a way to stop it.
 */
export function MapToolsButton({ battleMapId }) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState(null);
  const [drag, setDrag] = React.useState(false);

  React.useEffect(() => {
    const onMode = ClientMediator.on("BattleMap_ModeChanged", (data) => {
      if (data?.battleMapId !== battleMapId) return;
      setMode(modeLabel(data));
      setOpen(false); // a tool was picked (or put away): back to the map
    });
    const onDrag = ClientMediator.on("BattleMap_DragModeChanged", (data) => {
      if (data?.battleMapId !== battleMapId) return;
      setDrag(!!data.enabled);
      setOpen(false);
    });
    return () => {
      ClientMediator.off(onMode);
      ClientMediator.off(onDrag);
    };
  }, [battleMapId]);

  // Its own panel context: the Tools panel names itself, and must not rename the map's tab.
  const ctx = React.useMemo(() => makePanelContentContext({ w: PANEL_W, h: PANEL_H }), []);

  const active = mode || (drag ? "Drag" : null);
  const stop = () => {
    ClientMediator.sendCommand("BattleMap", "DisableAllModes", { contextId: battleMapId });
    ClientMediator.sendCommand("BattleMap", "SetDragMode", { contextId: battleMapId, enabled: false });
  };

  return (
    <div className="nm_mobileMapTools">
      <Flex align="center" gap="6px">
        <IconButton
          aria-label="Map tools"
          size="sm"
          borderRadius="full"
          variant={active ? "solid" : "outline"}
          bg={active ? themeColors.accent : themeColors.surfaceRaised}
          onClick={() => setOpen((o) => !o)}
        >
          <FaTools />
        </IconButton>
        {active && (
          <Flex align="center" className="nm_mobileMapToolsChip" bg={themeColors.surfaceRaised} borderColor={themeColors.border}>
            <Text as="span" fontSize="xs" px="8px">{active}</Text>
            <IconButton aria-label={`Stop ${active}`} size="2xs" variant="ghost" onClick={stop}>
              <FaTimes />
            </IconButton>
          </Flex>
        )}
      </Flex>
      {open && (
        <>
          <div className="nm_mobileMapToolsBackdrop" data-testid="map-tools-backdrop" onClick={() => setOpen(false)} />
          <Box
            className="nm_mobileMapToolsPanel"
            width={`${PANEL_W}px`}
            height={`min(${PANEL_H}px, 70vh)`}
            bg={themeColors.background}
            borderColor={themeColors.border}
          >
            <Dockable.ContentContext.Provider value={ctx}>
              <ToolsPanel battleMapId={battleMapId} />
            </Dockable.ContentContext.Provider>
          </Box>
        </>
      )}
    </div>
  );
}

export default MapToolsButton;
