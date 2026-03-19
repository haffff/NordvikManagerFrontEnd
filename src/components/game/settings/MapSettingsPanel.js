import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import { Tabs } from "@chakra-ui/react";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import WebSocketManagerInstance from "../WebSocketManager";
import Subscribable from "../../uiComponents/base/Subscribable";
import SecuritySettingsPanel from "./SecuritySettingsPanel";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import PropertiesSettingsPanel from "./PropertiesSettingsPanel";
import { SettingsPanelWithPropertySettings } from "./SettingsPanelWithPropertySettings";
import { toaster } from "../../ui/toaster";

export const MapSettingsPanel = ({ map }) => {
  const [mapDto, setMapDto] = React.useState(map);
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

  if (!map) {
    ctx.setTitle(`Map Settings - Empty`);
    return <></>;
  } else {
    ctx.setTitle(`Map Settings - ${map.name}`);
  }

  ctx.setPreferredSize(600,800);
  
  const sendSettingsUpdate = (dtoToSend) => {
    let dtoToSave = structuredClone(map);
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
            <SettingsPanelWithPropertySettings
              entityName={"MapModel"}
              dto={map}
              editableKeyLabelDict={editables}
              onSave={sendSettingsUpdate}
            />
          </Tabs.Content>
          <Tabs.Content value="permissions">
            <SecuritySettingsPanel dto={map} type="MapModel" />
          </Tabs.Content>
          <Tabs.Content value="props">
            <PropertiesSettingsPanel dto={map} type="MapModel" />
          </Tabs.Content>
        </Tabs.Root>
      </BasePanel>
    </Subscribable>
  );
};
export default MapSettingsPanel;
