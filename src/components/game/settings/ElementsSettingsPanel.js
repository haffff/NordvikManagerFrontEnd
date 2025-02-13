import * as React from "react";
import {
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Flex,
} from "@chakra-ui/react";
import { Box, Textarea } from "@chakra-ui/react";
import WebSocketManagerInstance from "../WebSocketManager";
import SettingsPanel from "./SettingsPanel";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import Subscribable from "../../uiComponents/base/Subscribable";
import SecuritySettingsPanel from "./SecuritySettingsPanel";
import DTOConverter from "../../BattleMap/DTOConverter";
import PropertiesSettingsPanel from "./PropertiesSettingsPanel";
import DButtonHorizontalContainer from "../../uiComponents/base/Containers/DButtonHorizontalContainer";
import DropDownButton from "../../uiComponents/base/DDItems/DropDrownButton";

export const ElementSettingsPanel = ({ dto, battlemapId }) => {
  const [directJson, setDirectJson] = React.useState(
    JSON.stringify({ ...dto.toJSON(), id: undefined }, null, 2)
  );

  const allEditables = [
    {
      key: "name",
      label: "Name",
      toolTip: "Name of element.",
      type: "string",
      required: true,
    },

    {
      key: "resourceId",
      label: "Image",
      toolTip: "Image of element",
      type: "image",
    },
    {
      key: "resourceKey",
      label: "Image key (If no image)",
      toolTip: "Image key of element",
      type: "string",
    },

    //Transform
    {
      category: "Transform",
      key: "left",
      label: "Location X",
      toolTip: "Location of element on battlemap.",
      type: "number",
    },
    {
      category: "Transform",
      key: "top",
      label: "Location Y",
      toolTip: "Location of element on battlemap.",
      type: "number",
    },
    //{ category: "Transform", key: "width", label: "Width", toolTip: "Width of element.", min: 0, type: "number" },    // just makes area bigger without touching the content. unnecessary
    //{ category: "Transform", key: "height", label: "Height", toolTip: "Height of element.", min: 0, type: "number" }, // just makes area bigger without touching the content. unnecessary
    {
      category: "Transform",
      key: "angle",
      label: "Rotation",
      toolTip: "Rotation of elemnt.",
      min: 0,
      max: 360,
      type: "number",
    },
    {
      category: "Transform",
      key: "skewX",
      label: "Skew X",
      toolTip: "Skew of element X.",
      min: 0,
      type: "number",
    },
    {
      category: "Transform",
      key: "skewY",
      label: "Skew Y",
      toolTip: "Skew of element Y.",
      min: 0,
      type: "number",
    },
    {
      category: "Transform",
      key: "flipX",
      label: "Flip X",
      toolTip: "Flip element in X Axis.",
      type: "boolean",
    },
    {
      category: "Transform",
      key: "flipY",
      label: "Flip Y",
      toolTip: "Flip element in Y Axis.",
      type: "boolean",
    },
    //{ category: "Transform", key: "visible", label: "Visible", toolTip: "Element is visible.", type: "boolean" },
    {
      category: "Transform",
      key: "scaleX",
      label: "Scale X",
      toolTip: "X Scale of element.",
      type: "number",
    },
    {
      category: "Transform",
      key: "scaleY",
      label: "Scale Y",
      toolTip: "Y Scale of element.",
      type: "number",
    },

    //Display

    {
      category: "Color",
      key: "fill",
      label: "Fill Color",
      toolTip: "",
      type: "color",
    }, // ??
    {
      category: "Color",
      key: "backgroundColor",
      label: "Background Color",
      toolTip: "",
      type: "color",
    }, // ??
    {
      category: "Color",
      key: "opacity",
      label: "Opacity",
      toolTip: "",
      type: "number",
    },
    {
      category: "Color",
      key: "paintFirst",
      label: "Paint First",
      toolTip: "",
      type: "string",
    },

    {
      category: "Stroke",
      key: "stroke",
      label: "Stroke Color",
      toolTip: "Color of stroke.",
      type: "color",
    },
    {
      category: "Stroke",
      key: "strokeWidth",
      label: "Stroke Width",
      toolTip: "Height of element.",
      type: "number",
    },
    //{ category: "Stroke", key: "strokeDashArray", label: "Stroke Dash Array", toolTip: "Height of element.", type: "string" },
    {
      category: "Stroke",
      key: "strokeLineCap",
      label: "Line Cap",
      toolTip: "Height of element.",
      type: "select",
      options: [
        { value: "butt", label: "Butt" },
        { value: "round", label: "Round" },
        { value: "square", label: "Square" },
      ],
    },
    {
      category: "Stroke",
      key: "strokeDashOffset",
      label: "Dash Offset",
      toolTip: "Height of element.",
      type: "string",
    },
    {
      category: "Stroke",
      key: "strokeLineJoin",
      label: "Line Join",
      toolTip: "Height of element.",
      type: "select",
      options: [
        { value: "miter", label: "Miter" },
        { value: "round", label: "Round" },
        { value: "bevel", label: "Bevel" },
      ],
    },
    {
      category: "Stroke",
      key: "strokeUniform",
      label: "Uniform",
      toolTip: "Height of element.",
      type: "boolean",
    },
    {
      category: "Stroke",
      key: "strokeMiterLimit",
      label: "Miter Limit",
      toolTip: "Height of element.",
      type: "string",
    },
  ];

  const JsonProperties = () => {
    let keys = Object.keys(dto);
    let filtered = allEditables.filter((x) => keys.includes(x.key));
    return filtered;
  };

  const sendSettingsUpdate = (dtoToSend) => {
    Object.keys(dtoToSend).forEach((key) => {
      if (key !== "id" && dtoToSend[key] !== undefined) {
        dto[key] = dtoToSend[key];
      }
    });

    const finalDTO = DTOConverter.ConvertToDTO(dto);

    let cmd = CommandFactory.CreateBattleMapUpdateCommand(
      finalDTO,
      battlemapId
    );
    WebSocketManagerInstance.Send(cmd);
  };

  const updateSettings = (event) => {};

  return (
    <Subscribable commandPrefix={"element"} onMessage={updateSettings}>
      <Tabs.Root lazyMount marginTop={3} size="md" variant="enclosed">
        <Tabs.List>
          <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
          <Tabs.Trigger value="permissions">Permissions</Tabs.Trigger>
          <Tabs.Trigger value="props">Properties</Tabs.Trigger>
          <Tabs.Trigger value="direct" color={"darkgray"}>
            Direct Edit
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="settings">
          <SettingsPanel
            dto={dto}
            editableKeyLabelDict={JsonProperties()}
            onSave={sendSettingsUpdate}
            showSearch={true}
          />
        </Tabs.Content>
        <Tabs.Content value="permissions">
          <SecuritySettingsPanel dto={dto} type="ElementModel" />
        </Tabs.Content>
        <Tabs.Content value="props">
          <PropertiesSettingsPanel dto={dto} type="ElementModel" />
        </Tabs.Content>
        <Tabs.Content value="direct">
          <Flex justifyContent={'stretch'} align={'stretch'} justifySelf={'stretch'} flexDir="column" flex={1} grow={1}>
            <Textarea
              flexGrow={1}
              flex={1}
              value={directJson}
              onChange={(e) => setDirectJson(e.target.value)}
              readOnly={false}
            />
            <DButtonHorizontalContainer>
              <DropDownButton
                name={"Save"}
                onClick={() => {
                  let dtoToSend = JSON.parse(directJson);
                  sendSettingsUpdate(dtoToSend);
                }}
              />
            </DButtonHorizontalContainer>
          </Flex>
        </Tabs.Content>
      </Tabs.Root>
    </Subscribable>
  );
};

export default ElementSettingsPanel;
