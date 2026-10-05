import * as React from "react";
import { Tabs } from "@chakra-ui/react";
import { ActiveTransportManager as WebSocketManagerInstance, ActiveWebHelper as WebHelper } from "../../../helpers/transport";
import SettingsPanel from "./SettingsPanel";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import Subscribable from "../../uiComponents/base/Subscribable";
import SecuritySettingsPanel from "./SecuritySettingsPanel";
import DTOConverter from "../../BattleMap/DTOConverter";
import PropertiesSettingsPanel from "./PropertiesSettingsPanel";
import DButtonHorizontalContainer from "../../uiComponents/base/Containers/DButtonHorizontalContainer";
import DropDownButton from "../../uiComponents/base/DDItems/DropDrownButton";
import { toaster } from "../../ui/toaster";
import ClientMediator from "../../../ClientMediator";
import { JsonEditor } from "../../uiComponents/JsonEditor";

export const ElementSettingsPanel = ({ dto, battlemapId }) => {
  const [directValue, setDirectValue] = React.useState({ ...dto.toJSON(), id: undefined });
  // jsoneditor-react's <Editor> only reads `value` at mount — it does not resync
  // when the prop changes externally (see JsonEditor.js's own comment). Bumping
  // this on a LIVE update (not on the editor's own onChange) forces a remount
  // via `key` so the "a live change overwrites the editor" behavior this tab
  // already had keeps working; the user's own edits don't bump it, so typing
  // doesn't get reset mid-edit.
  const [directRevision, setDirectRevision] = React.useState(0);

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
    //let keys = Object.keys(dto);
    //let filtered = allEditables.filter((x) => keys.includes(x.key));
    return allEditables;
  };

  // Per-token override tier for the generic element-masking system (see
  // TokenManager._resolveMaskStates) — zero addon-specific strings here either:
  // this just enumerates whatever maskGroup/label the token's OWN additions
  // declared. Absent on any non-token element (additionalObjects undefined) or
  // a token whose additions don't opt into masking.
  const maskableGroups = React.useMemo(() => {
    const found = new Map();
    for (const element of dto?.additionalObjects ?? []) {
      const group = element.tokenData?.maskGroup;
      if (!group || found.has(group)) continue;
      found.set(group, element.tokenData?.label ?? group);
    }
    return Array.from(found, ([maskGroup, label]) => ({ maskGroup, label }));
  }, [dto]);

  const maskEditables = React.useMemo(() => maskableGroups.flatMap((g) => [
    {
      key: `mask_${g.maskGroup}_enabled`,
      property: true,
      label: `${g.label} — Enabled`,
      toolTip: `Override this map's default for "${g.label}" on this one token. Leave unset to inherit the map-wide setting (see this map's own settings).`,
      type: "boolean",
      category: "Override",
    },
    {
      key: `mask_${g.maskGroup}_gmonly`,
      property: true,
      label: `${g.label} — GM Only`,
      toolTip: `Override this map's default GM-only setting for "${g.label}" on this one token.`,
      type: "boolean",
      category: "Override",
    },
  ]), [maskableGroups]);

  // A dedicated small fetch instead of reusing SettingsPanelWithPropertySettings:
  // that component internally does `structuredClone(dto)` to build its merged
  // snapshot, which throws on a live Fabric object (circular canvas refs, methods)
  // — silently, inside an async WebHelper.get callback, leaving its mergedDto
  // state stuck at null forever (an empty "Token" tab, no console-visible error
  // in the panel itself). `dto` here IS the live Fabric object (see `dto.toJSON()`
  // above), unlike MapSettingsPanel's plain MapModel dto that component was built
  // for — so this tab needs its own plain, cloneable snapshot object instead.
  const [maskDto, setMaskDto] = React.useState(null);

  React.useEffect(() => {
    if (!maskableGroups.length) {
      setMaskDto(null);
      return;
    }
    const maskKeys = maskEditables.map((e) => e.key);
    WebHelper.get("properties/QueryProperties?parentIds=" + dto.id, (data) => {
      const propValues = { id: dto.id };
      maskKeys.forEach((key) => {
        const found = data?.find((x) => x.name === key);
        propValues[key] = found?.value === "true" || found?.value === "True" || found?.value === true;
      });
      setMaskDto(propValues);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dto.id, maskableGroups.length]);

  const saveMaskSettings = async (dtoToSend) => {
    const maskKeys = maskEditables.map((e) => e.key);
    const freshData = await WebHelper.getAsync("properties/QueryProperties?parentIds=" + dto.id);
    const freshProps = (freshData ?? []).filter((p) => maskKeys.includes(p.name));

    const propsToUpdate = [];
    Object.keys(dtoToSend).forEach((key) => {
      const existing = freshProps.find((p) => p.name === key);
      const value = dtoToSend[key]?.toString() ?? "";
      if (existing) {
        propsToUpdate.push({ ...existing, value });
      } else {
        WebSocketManagerInstance.Send({
          command: "property_add",
          data: { name: key, value, parentId: dto.id, EntityName: "ElementModel" },
        });
      }
    });

    if (propsToUpdate.length > 0) {
      await ClientMediator.sendCommandAsync("properties", "UpdateBulk", { properties: propsToUpdate });
    }

    setMaskDto((prev) => ({ ...prev, ...dtoToSend }));
  };

  const sendSettingsUpdate = (dtoToSend) => {
    // Apply the changed keys onto the live Fabric object so the canvas reflects the edit,
    // but do it via set() so Fabric can react properly where possible.
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

  const updateSettings = (event) => {
    // dto is the live Fabric object (circular canvas/group refs — see the
    // comment above maskDto's declaration for the same hazard). Spreading it
    // directly, instead of dto.toJSON() like the initial useState above does,
    // fed jsoneditor-react's <Editor> a circular value and blew the stack
    // ("Maximum call stack size exceeded") the next time a live update landed
    // while the Direct Edit tab was open.
    setDirectValue({ ...dto.toJSON(), ...event.data, id: undefined });
    setDirectRevision((r) => r + 1);

    if (event.playerId === ClientMediator.sendCommand("Game", "GetCurrentPlayer").id) {
      toaster.create({
        description: "Element settings updated",
        type: "success",
        duration: 5000,
      });
    }
  };

  return (
    <Subscribable commandPrefix={"element"} onMessage={updateSettings}>
      <Tabs.Root defaultValue={"settings"} lazyMount marginTop={3} size="md" variant="enclosed">
        <Tabs.List>
          <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
          <Tabs.Trigger value="permissions">Permissions</Tabs.Trigger>
          <Tabs.Trigger value="props">Properties</Tabs.Trigger>
          {maskableGroups.length > 0 && <Tabs.Trigger value="token">Token</Tabs.Trigger>}
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
        {maskableGroups.length > 0 && (
          <Tabs.Content value="token">
            <SettingsPanel
              dto={maskDto}
              editableKeyLabelDict={maskEditables}
              onSave={saveMaskSettings}
            />
          </Tabs.Content>
        )}
        <Tabs.Content value="direct">
            <JsonEditor
              key={directRevision}
              value={directValue}
              onChange={setDirectValue}
            />
            <DButtonHorizontalContainer>
              <DropDownButton
                name={"Save"}
                onClick={() => sendSettingsUpdate(directValue)}
              />
            </DButtonHorizontalContainer>
        </Tabs.Content>
      </Tabs.Root>
    </Subscribable>
  );
};

export default ElementSettingsPanel;
