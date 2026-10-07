import * as React from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Stack,
  Text,
} from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import { FaHtml5, FaMinus, FaPlus, FaLayerGroup, FaArrowDown } from "react-icons/fa";
import { toaster } from "../../../ui/toaster";
import { BasePanel } from "../../../uiComponents/base/BasePanel";
import CollectionSyncer from "../../../uiComponents/base/CollectionSyncer";
import DTreeList from "../../../uiComponents/treeList/DTreeList";
import DListItem from "../../../uiComponents/base/List/DListItem";
import DLabel from "../../../uiComponents/base/Text/DLabel";
import DListItemButton from "../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import DListItemsButtonContainer from "../../../uiComponents/base/List/DListItemsButtonContainer";
import { SettingsPanelWithPropertySettings } from "../../settings/SettingsPanelWithPropertySettings";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../helpers/transport";
import { ActiveWebHelper as WebHelper } from "../../../../helpers/transport";
import ClientMediator from "../../../../ClientMediator";
import { ResizeDivider, useDragResize } from "../../../uiComponents/ResizeDivider";
import themeColors from "../../../../helpers/themeColors";

// ── Module-level constants ────────────────────────────────────────────────────

const EDITABLE_DICT = [
  { key: "name", label: "UI Name", type: "string" },
  { key: "description", label: "Description", type: "textarea" },
  {
    key: "isHidden",
    label: "Hidden",
    type: "boolean",
    toolTip: "Leave this template out of template lists (it stays usable by id and name, e.g. from actions).",
  },
  {
    key: "mainResource",
    label: "Main Resource (HTML)",
    type: "materialSelect",
    additionalFilter: (item) => item.mimeType === "text/html",
  },
  {
    key: "additionalResources",
    label: "Additional Resources",
    type: "materialSelect",
    multiple: true,
  },
  {
    key: "token",
    property: true,
    label: "Default Token",
    type: "materialSelect",
    additionalFilter: (item) => item.mimeType === "application/json",
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

const TemplateCard = React.memo(({ template, isSelected, onSelect, onDelete }) => (
  <DListItem
    isSelected={isSelected}
    onClick={() => onSelect(template)}
  >
    <DLabel>{template.name}</DLabel>
    {template.isHidden && (
      <Text fontSize="2xs" color="fg.muted" ml={1} title="Left out of template lists">
        hidden
      </Text>
    )}
    <DListItemsButtonContainer>
      <DListItemButton
        icon={FaMinus}
        color="red"
        label="Delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(template);
        }}
      />
    </DListItemsButtonContainer>
  </DListItem>
));

const EmptyState = () => (
  <Flex
    direction="column"
    align="center"
    justify="center"
    gap="12px"
    height="100%"
    color="gray.500"
    userSelect="none"
  >
    <Icon as={FaLayerGroup} boxSize={10} opacity={0.35} />
    <Text fontSize="sm">Select a template to edit it</Text>
  </Flex>
);

const ResourceBadges = ({ template }) => {
  const hasJs = Boolean(template.mainResource);
  const extraCount = Array.isArray(template.additionalResources)
    ? template.additionalResources.length
    : 0;
  return (
    <HStack gap="6px" flexShrink={0}>      {hasJs && (
        <Badge colorPalette="orange" variant="subtle" fontSize="10px">
          <HStack gap="3px">
            <Icon as={FaHtml5} />
            <span>HTML</span>
          </HStack>
        </Badge>
      )}
      {extraCount > 0 && (
        <Badge colorPalette="purple" variant="subtle" fontSize="10px">
          +{extraCount} res
        </Badge>
      )}
    </HStack>
  );
};

const RightPaneHeader = ({
  template,
  confirmDelete,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
}) => (
  <Flex
    align="center"
    px="12px"
    py="8px"
    borderBottomWidth="1px"
    borderColor={themeColors.divider}
    gap="10px"
    flexShrink={0}
  >
    <DLabel>{template.name}</DLabel>
    <ResourceBadges template={template} />
    <Flex grow={1} />
    {confirmDelete ? (
      <HStack gap="6px">
        <Text fontSize="xs" color="red.400">Delete?</Text>
        <Button size="xs" colorScheme="red" variant="solid" onClick={onConfirmDelete}>
          Yes
        </Button>
        <Button size="xs" variant="outline" onClick={onCancelDelete}>
          No
        </Button>
      </HStack>
    ) : (
      <DListItemButton
        icon={FaMinus}
        color="red"
        label="Delete template"
        onClick={onDelete}
      />
    )}
  </Flex>
);

// ── Main component ────────────────────────────────────────────────────────────

export const TemplatesPanel = ({ gameDataRef }) => {
  const [templates, setTemplates] = React.useState([]);
  const [selectedTemplate, setSelectedTemplate] = React.useState(null);
  const treeRefreshRef = React.useRef(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [pushing, setPushing] = React.useState(false);

  // Resizable sidebar
  const colContainerRef = React.useRef(null);
  const { fracs, onDividerMouseDown } = useDragResize(colContainerRef, [0.35]);

  React.useEffect(() => {
    const load = async () => {
      const gameId = await ClientMediator.sendCommandAsync("Game", "GetGameId");
      const data = await WebHelper.getAsync(
        "materials/GetTemplatesFull?gameid=" + gameId
      );
      if (data) setTemplates(data);
    };
    load();
  }, []);

  // Reset two-step confirm when selection changes
  React.useEffect(() => {
    setConfirmDelete(false);
  }, [selectedTemplate?.id]);

  const ctx = Dockable.useContentContext();
  ctx.setTitle("Templates");

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleAdd = () => {
    WebSocketManagerInstance.Send({
      command: "template_add",
      data: { name: "New Template", description: "", content: "", dataCommandPrefix: "" },
    });
  };

  const handleDelete = (template) => {
    WebSocketManagerInstance.Send({ command: "template_delete", data: template.id });
    if (selectedTemplate?.id === template.id) setSelectedTemplate(null);
  };

  const handleSave = (dto) => {
    WebSocketManagerInstance.Send({
      command: "template_update",
      data: { ...selectedTemplate, ...dto },
    });
  };

  const handlePushToCards = async () => {
    if (!selectedTemplate || pushing) return;
    setPushing(true);
    try {
      const gameId = await ClientMediator.sendCommandAsync("Game", "GetGameId");

      // Load this template's token property
      const templateProps = await WebHelper.getAsync(
        `properties/QueryProperties?parentIds=${selectedTemplate.id}&names=token`
      );
      const tokenValue = templateProps?.find((p) => p.name === "token")?.value ?? null;

      // Get all cards (flat list: id + name only)
      const allCards = await WebHelper.getAsync(`materials/GetCards?gameid=${gameId}`);
      if (!allCards?.length) {
        toaster.create({ description: "No cards found in this game.", type: "info", duration: 4000 });
        return;
      }

      // Find cards whose template_id property matches this template
      const cardIds = allCards.map((c) => c.id).join(",");
      const templateIdProps = await WebHelper.getAsync(
        `properties/QueryProperties?parentIds=${cardIds}&names=template_id`
      );
      const matchingCardIds = (templateIdProps ?? [])
        .filter((p) => p.value === selectedTemplate.id)
        .map((p) => p.parentId);

      if (!matchingCardIds.length) {
        toaster.create({ description: "No cards are using this template.", type: "info", duration: 4000 });
        return;
      }

      // Update mainResource + additionalResources on each matching card
      for (const cardId of matchingCardIds) {
        const card = allCards.find((c) => c.id === cardId);
        if (!card) continue;
        WebSocketManagerInstance.Send({
          command: "card_update",
          data: {
            ...card,
            mainResource: selectedTemplate.mainResource ?? null,
            additionalResources: selectedTemplate.additionalResources ?? [],
          },
        });
      }

      // Update token property if the template has one set
      if (tokenValue) {
        const existingTokenProps = await WebHelper.getAsync(
          `properties/QueryProperties?parentIds=${matchingCardIds.join(",")}&names=token`
        );

        // Update cards that already have a token property
        const toUpdate = (existingTokenProps ?? []).map((p) => ({ ...p, value: tokenValue }));
        if (toUpdate.length > 0) {
          await WebHelper.postAsync("properties/UpdateBulk", toUpdate);
        }

        // Add token property for cards that don't have one yet
        const cardsWithToken = new Set((existingTokenProps ?? []).map((p) => p.parentId));
        for (const cardId of matchingCardIds) {
          if (!cardsWithToken.has(cardId)) {
            WebSocketManagerInstance.Send({
              command: "property_add",
              data: { name: "token", value: tokenValue, parentId: cardId, entityName: "CardModel" },
            });
          }
        }
      }

      toaster.create({
        description: `Updated ${matchingCardIds.length} card(s) from template.`,
        type: "success",
        duration: 5000,
      });
    } catch (err) {
      console.error("handlePushToCards error:", err);
      toaster.create({ description: "Failed to push to cards.", type: "error", duration: 5000 });
    } finally {
      setPushing(false);
    }
  };

  // ── Derived state ────────────────────────────────────────────────────────────


  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <BasePanel>
      <CollectionSyncer
        collection={templates}
        setCollection={setTemplates}
        commandPrefix="template"
        onAdd={(newTemplate) => {
          setSelectedTemplate(newTemplate);
          // The server files the new template in the folder tree on the next load.
          treeRefreshRef.current?.();
        }}
        onDelete={(deletedId) => {
          if (selectedTemplate?.id === deletedId) setSelectedTemplate(null);
        }}
      />      <Flex height="100%" width="100%" overflow="hidden" ref={colContainerRef}>

        {/* ── Left list pane ── */}
        <Stack
          width={`${fracs[0] * 100}%`}
          flexShrink={0}
          height="100%"
          overflow="hidden"
          gap={0}
        >
          {/* Folder tree (with its own search) */}
          <Flex flex={1} minH={0} direction="column" px="4px" pt="4px">
            <DTreeList
              entityType="CardTemplate"
              items={templates}
              canEditFolders
              refreshRef={treeRefreshRef}
              estimatedRowHeight={44}
              onSelect={(sel) => { if (sel?.itemRef) setSelectedTemplate(sel.itemRef); }}
              generateItem={(t) => (
                <TemplateCard
                  template={t}
                  isSelected={selectedTemplate?.id === t.id}
                  onSelect={setSelectedTemplate}
                  onDelete={handleDelete}
                />
              )}
            />
          </Flex>

          {/* Pinned add button */}
          <Box px="6px" py="6px" borderTopWidth="1px" borderColor={themeColors.divider}>
            <Button variant="outline" size="sm" width="100%" onClick={handleAdd}>
              <HStack gap="6px">
                <Icon as={FaPlus} />
                <span>New Template</span>
              </HStack>
            </Button>
          </Box>
        </Stack>

        <ResizeDivider onMouseDown={(e) => onDividerMouseDown(0, e)} />

        {/* ── Right detail pane ── */}
        <Flex direction="column" flex={1} height="100%" overflow="hidden">
          {selectedTemplate ? (
            <>
              <RightPaneHeader
                template={selectedTemplate}
                confirmDelete={confirmDelete}
                onDelete={() => setConfirmDelete(true)}
                onConfirmDelete={() => {
                  handleDelete(selectedTemplate);
                  setConfirmDelete(false);
                }}
                onCancelDelete={() => setConfirmDelete(false)}
              />
              <Box flex={1} overflowY="auto" px="4px" py="4px">
                <SettingsPanelWithPropertySettings
                  withExport
                  key={selectedTemplate.id}
                  entityName="CardModel"
                  editableKeyLabelDict={EDITABLE_DICT}
                  dto={selectedTemplate}
                  onSave={handleSave}
                />
                {/* ── Push to cards ── */}
                <Box
                  mx="4px"
                  mt="4px"
                  mb="8px"
                  p="12px"
                  borderWidth="1px"
                  borderColor={themeColors.divider}
                  borderRadius="md"
                >
                  <Text fontSize="sm" fontWeight="medium" color="gray.200" mb="6px">
                    Push to cards
                  </Text>
                  <Text fontSize="xs" color="gray.400" mb="8px">
                    Updates all cards using this template: main resource, additional resources, and default token.
                  </Text>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={pushing}
                    onClick={handlePushToCards}
                  >
                    <HStack gap="6px">
                      <Icon as={FaArrowDown} />
                      <span>Push to all using this template</span>
                    </HStack>
                  </Button>
                </Box>
              </Box>
            </>
          ) : (
            <EmptyState />
          )}
        </Flex>

      </Flex>
    </BasePanel>
  );
};

export default TemplatesPanel;
