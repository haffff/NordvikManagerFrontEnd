import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import { Tabs } from "@chakra-ui/react";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import Subscribable from "../../uiComponents/base/Subscribable";
import SecuritySettingsPanel from "./SecuritySettingsPanel";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import PropertiesSettingsPanel from "./PropertiesSettingsPanel";
import { SettingsPanelWithPropertySettings } from "./SettingsPanelWithPropertySettings";
import { toaster } from "../../ui/toaster";
import ClientMediator from "../../../ClientMediator";

// A Map (MapModel) can be loaded into zero or more currently-open BattleMap panel
// instances (TokenManager is per-panel, keyed by the panel's own contextId, not
// by the map's id) — resolve which open battle map, if any, currently has THIS
// map loaded, since that's the only place `GetAvailableMaskGroups` can scan live
// tokens from.
const _findOpenBattleMapContextIdForMap = (mapId) => {
  const opened = ClientMediator.sendCommand("Game", "GetOpenedBattleMaps") ?? [];
  for (const ctx of opened) {
    const loadedMap = ClientMediator.sendCommand("BattleMap", "GetSelectedMap", { contextId: ctx.id });
    if (loadedMap?.id === mapId) return ctx.id;
  }
  return undefined;
};

export const MapSettingsPanel = ({ map }) => {
  const [mapDto, setMapDto] = React.useState(map);
  // null = not resolved yet (gates rendering below), [] = resolved, none found
  const [maskGroups, setMaskGroups] = React.useState(null);

  React.useEffect(() => {
    setMaskGroups(null);
    if (!map?.id) return;
    const battleMapId = _findOpenBattleMapContextIdForMap(map.id);
    if (!battleMapId) {
      // Map isn't currently open on any battle map panel — no live canvas to
      // scan tokens from, so there's nothing to list (not an error).
      setMaskGroups([]);
      return;
    }
    ClientMediator.sendCommandAsync("BattleMap_token", "GetAvailableMaskGroups", { contextId: battleMapId })
      .then((groups) => setMaskGroups(groups ?? []))
      .catch(() => setMaskGroups([]));
  }, [map?.id]);

  // One Enabled + one GM Only boolean field per distinct maskGroup found among
  // tokens actually on the map — zero hardcoded knowledge of what any addon's
  // tokens declare; a different addon's tokens would surface entirely different
  // rows here.
  const maskEditables = React.useMemo(() => (maskGroups ?? []).flatMap((g) => [
    {
      key: `mask_${g.maskGroup}_enabled`,
      property: true,
      label: `${g.label} — Enabled`,
      toolTip: `Show or hide "${g.label}" on every token on this map. A specific token's own settings can override this.`,
      type: "boolean",
      category: "Token Elements",
    },
    {
      key: `mask_${g.maskGroup}_gmonly`,
      property: true,
      label: `${g.label} — GM Only`,
      toolTip: `When enabled, "${g.label}" is only visible to the GM, even when shown above.`,
      type: "boolean",
      category: "Token Elements",
    },
  ]), [maskGroups]);

  const editables = [
    {
      key: "name",
      label: "Name",
      toolTip: "The display name of this map.",
      type: "string",
    },
    {
      key: "width",
      label: "Map Width",
      toolTip: "Total width of the map canvas in pixels.",
      min: 100,
      type: "number",
    },
    {
      key: "height",
      label: "Map Height",
      toolTip: "Total height of the map canvas in pixels.",
      min: 100,
      type: "number",
    },
    {
      key: "gridSize",
      label: "Size of Grid",
      toolTip: "Size of each grid square in pixels. Affects snapping and distance calculations.",
      min: 10,
      type: "number",
    },
    {
      key: "gridVisible",
      label: "Show Grid",
      toolTip: "Toggle the visibility of the grid overlay on the map.",
      type: "boolean",
    },
    {
      key: "gridColor",
      label: "Grid Color",
      toolTip: "Color of the grid lines overlaid on the map.",
      type: "color",
    },

    {
      key: "useCustomUnits",
      property: true,
      label: "Use Custom Unit System",
      toolTip: "Enable a custom distance unit system for this map, overriding the game-wide defaults.",
      type: "boolean",
      category: "Units",
    },
    {
      key: "useSquaredSystem",
      property: true,
      disableOn: (dto) => dto?.useCustomUnits !== true,
      label: "Realistic Distance (Diagonal)",
      toolTip: "When enabled, diagonal movement costs more than cardinal movement (Pythagorean distance). When disabled, all adjacent squares cost the same (Chebyshev distance).",
      type: "boolean",
      category: "Units",
    },
    {
      key: "baseDistancePerSquare",
      property: true,
      disableOn: (dto) => dto?.useCustomUnits !== true,
      min: 1,
      label: "Distance per Square",
      toolTip: "How many real-world distance units one grid square represents (e.g. 5 for \"5 ft\" or \"5 m\" per square).",
      type: "number",
      category: "Units",
    },
    {
      key: "baseDistanceUnit",
      property: true,
      disableOn: (dto) => dto?.useCustomUnits !== true,
      label: "Distance Unit Label",
      toolTip: "The unit label appended to distance values, e.g. \"ft\", \"m\", or \"km\".",
      type: "string",
      category: "Units",
    },
    //{key: "password", label:"Password:", toolTip:"Password that other players need to know to join the game.", type:"string"}
  ];

  const ctx = Dockable.useContentContext();

  // Resync when the panel is pointed at a different map — updateSettings below
  // already keeps mapDto current for the *same* map's own websocket-confirmed
  // edits; this only covers actually switching maps.
  React.useEffect(() => {
    setMapDto(map);
  // Deliberately keyed on map?.id only, not the whole `map` object — we want to
  // resync when the panel switches to a different map, not on every re-render
  // where the parent happens to pass a new `map` object reference for the same map.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map?.id]);

  if (!map) {
    ctx.setTitle(`Map Settings - Empty`);
    return <></>;
  } else {
    ctx.setTitle(`Map Settings - ${map.name}`);
  }

  ctx.setPreferredSize(600,800);
  
  const sendSettingsUpdate = (dtoToSend) => {
    let dtoToSave = structuredClone(mapDto);
    Object.keys(dtoToSend).forEach((key) => {
      dtoToSave[key] = dtoToSend[key];
    });

    dtoToSave.elements = undefined;

    let command = CommandFactory.CreateMapSettingsCommand(dtoToSave);
    console.log(command);
    WebSocketManagerInstance.Send(command);
  };
  const updateSettings = (event) => {
    if (map.id !== event.data.id) {
      return;
    }

    const newDto = { ...mapDto, ...event.data };
    setMapDto(newDto);

    toaster.create({
      description: "Map settings saved.",
      type: "success",
      duration: 4000,
    });
  };

  return (
    <Subscribable commandPrefix={"settings_map"} onMessage={updateSettings}>
      <BasePanel>
        <Tabs.Root defaultValue={"settings"} size="md" variant="enclosed">
          <Tabs.List>
            <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
            <Tabs.Trigger value="permissions">Permissions</Tabs.Trigger>
            <Tabs.Trigger value="props">Properties</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="settings">
            {/* Gated on maskGroups being resolved (not just `map`) — mask rows must
                already be present in editableKeyLabelDict the FIRST time this mounts,
                since SettingsPanelWithPropertySettings only fetches property values
                once, keyed on dto.id, not on the dict changing later. */}
            {maskGroups !== null && (
              <SettingsPanelWithPropertySettings
                entityName={"MapModel"}
                dto={mapDto}
                editableKeyLabelDict={[...editables, ...maskEditables]}
                onSave={sendSettingsUpdate}
              />
            )}
          </Tabs.Content>
          <Tabs.Content value="permissions">
            <SecuritySettingsPanel dto={mapDto} type="MapModel" />
          </Tabs.Content>
          <Tabs.Content value="props">
            <PropertiesSettingsPanel dto={mapDto} type="MapModel" />
          </Tabs.Content>
        </Tabs.Root>
      </BasePanel>
    </Subscribable>
  );
};
export default MapSettingsPanel;
