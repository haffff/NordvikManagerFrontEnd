import * as React from "react";
import { Tabs } from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import WebSocketManagerInstance from "../WebSocketManager";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import Subscribable from "../../uiComponents/base/Subscribable";
import SecuritySettingsPanel from "./SecuritySettingsPanel";
import PropertiesSettingsPanel from "./PropertiesSettingsPanel";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import { SettingsPanelWithPropertySettings } from "./SettingsPanelWithPropertySettings";
import WebHelper from "../../../helpers/WebHelper";
import { toaster } from "../../ui/toaster";

export const CardSettingsPanel = ({ cardId }) => {  const [dto, setDto] = React.useState(undefined);

  const generalSettings = [
    {
      key: "name",
      label: "Card name",
      toolTip: "Card name.",
      type: "string",
      required: true,
    },
    {
      key: "character_name",
      label: "Character name",
      toolTip: "Name of character",
      type: "string",
      required: false,
      property: true,
    },
    {
      key: "player_owner",
      label: "Player owner",
      toolTip: "Player owner",
      type: "playerSelect",
      required: false,
      property: true,
    },
  ];

  const tokenEditables = [
    {
      key: "tokenImage",
      label: "Token Image",
      type: "image",
      required: false,
      property: true,
    },
    {
      key: "token",
      label: "Token",
      toolTip: ".",
      type: "materialSelect",
      additionalFilter: (foundItem) =>
        foundItem.mimeType === "application/json",
      property: true,
    },
    {
      key: "drop_token_size",
      label: "Token Size",
      type: "number",
      min: 1,
      max: 20,
      property: true,
    },
  ];
  const ctx = Dockable.useContentContext();
  React.useEffect(() => {
    if (cardId === undefined) {
      return;
    }
    WebHelper.get(
      "materials/getcard?id=" + cardId,
      (response) => {
        setDto(response);
        ctx.setTitle(`Card Settings - ${response.name}`);
      },
      (error) => console.log(error)
    );
  // ctx is a stable panel-context reference — safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  if (dto === undefined) {
    return <></>;
  }

  const sendSettingsUpdate = (dtoToSend) => {
    let dtoToSave = structuredClone(dto);
    Object.keys(dtoToSend).forEach((key) => {
      dtoToSave[key] = dtoToSend[key];
    });

    let command = CommandFactory.CreateGameSettingsCommand(dtoToSave);
    WebSocketManagerInstance.Send(command);
  };
  const updateSettings = (event) => {
    if (event.data?.id !== dto?.id) return;

    toaster.create({
      description: "Card settings saved.",
      type: "success",
      duration: 4000,
    });
  };

  return (
    <BasePanel>
      <Tabs.Root defaultValue={"settings"} marginTop={3} size="md" variant="enclosed">
        <Tabs.List>
          <Tabs.Trigger value="settings">General</Tabs.Trigger>
          <Tabs.Trigger value="token">Token Settings</Tabs.Trigger>
          <Tabs.Trigger value="perms">Permissions</Tabs.Trigger>
          <Tabs.Trigger value="props">Properties</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="settings">
          <SettingsPanelWithPropertySettings
            dto={dto}
            entityName={"CardModel"}
            editableKeyLabelDict={generalSettings}
            onSave={sendSettingsUpdate}
          />
        </Tabs.Content>
        <Tabs.Content value="token">
          <SettingsPanelWithPropertySettings
            key={dto.id}
            dto={dto}
            entityName={"CardModel"}
            editableKeyLabelDict={tokenEditables}
          />
        </Tabs.Content>
        <Tabs.Content value="perms">
          <SecuritySettingsPanel dto={dto} type="CardModel" />
        </Tabs.Content>
        <Tabs.Content value="props">
          <PropertiesSettingsPanel dto={dto} type="CardModel" />
        </Tabs.Content>
      </Tabs.Root>

      <Subscribable
        commandPrefix={"settings_card"}
        onMessage={updateSettings}
      />
    </BasePanel>
  );
};

export default CardSettingsPanel;
