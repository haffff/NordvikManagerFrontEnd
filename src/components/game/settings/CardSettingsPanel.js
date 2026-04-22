import * as React from "react";
import { Tabs, Box, Button, HStack, Icon, Text } from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import Subscribable from "../../uiComponents/base/Subscribable";
import SecuritySettingsPanel from "./SecuritySettingsPanel";
import PropertiesSettingsPanel from "./PropertiesSettingsPanel";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import { SettingsPanelWithPropertySettings } from "./SettingsPanelWithPropertySettings";
import { ActiveWebHelper as WebHelper } from "../../../helpers/transport";
import { toaster } from "../../ui/toaster";
import { FaArrowUp } from "react-icons/fa";
import ClientMediator from "../../../ClientMediator";

export const CardSettingsPanel = ({ cardId }) => {
  const [dto, setDto] = React.useState(undefined);
  const [updatingFromTemplate, setUpdatingFromTemplate] = React.useState(false);

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

  const handleUpdateFromTemplate = async () => {
    if (!dto || updatingFromTemplate) return;
    setUpdatingFromTemplate(true);
    try {
      // Find this card's template_id property
      const cardProps = await WebHelper.getAsync(
        `properties/QueryProperties?parentIds=${dto.id}&names=template_id`
      );
      const templateId = cardProps?.find((p) => p.name === "template_id")?.value;
      if (!templateId) {
        toaster.create({ description: "This card has no template assigned.", type: "warning", duration: 4000 });
        return;
      }

      // Load the template
      const gameId = await ClientMediator.sendCommandAsync("Game", "GetGameId");
      const allTemplates = await WebHelper.getAsync(`materials/GetTemplatesFull?gameid=${gameId}`);
      const template = allTemplates?.find((t) => t.id === templateId);
      if (!template) {
        toaster.create({ description: "Template not found.", type: "error", duration: 4000 });
        return;
      }

      // Update mainResource + additionalResources
      WebSocketManagerInstance.Send({
        command: "card_update",
        data: {
          ...dto,
          mainResource: template.mainResource ?? null,
          additionalResources: template.additionalResources ?? [],
        },
      });

      // Update token property from template
      const templateProps = await WebHelper.getAsync(
        `properties/QueryProperties?parentIds=${templateId}&names=token`
      );
      const tokenValue = templateProps?.find((p) => p.name === "token")?.value ?? null;

      if (tokenValue) {
        const existingTokenProps = await WebHelper.getAsync(
          `properties/QueryProperties?parentIds=${dto.id}&names=token`
        );
        const existingToken = existingTokenProps?.find((p) => p.name === "token");
        if (existingToken) {
          await WebHelper.postAsync("properties/UpdateBulk", [{ ...existingToken, value: tokenValue }]);
        } else {
          WebSocketManagerInstance.Send({
            command: "property_add",
            data: { name: "token", value: tokenValue, parentId: dto.id, EntityName: "CardModel" },
          });
        }
      }

      toaster.create({ description: "Card updated from template.", type: "success", duration: 4000 });
    } catch (err) {
      console.error("handleUpdateFromTemplate error:", err);
      toaster.create({ description: "Failed to update from template.", type: "error", duration: 4000 });
    } finally {
      setUpdatingFromTemplate(false);
    }
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
          <Box mx="4px" mt="4px" mb="8px" p="12px" borderWidth="1px" borderColor="rgb(70,70,70)" borderRadius="md">
            <Text fontSize="sm" fontWeight="medium" color="gray.200" mb="6px">Update from template</Text>
            <Text fontSize="xs" color="gray.400" mb="8px">
              Pulls main resource, additional resources, and default token from this card's assigned template.
            </Text>
            <Button size="sm" variant="outline" loading={updatingFromTemplate} onClick={handleUpdateFromTemplate}>
              <HStack gap="6px">
                <Icon as={FaArrowUp} />
                <span>Update from template</span>
              </HStack>
            </Button>
          </Box>
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
