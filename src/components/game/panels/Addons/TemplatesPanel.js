import * as React from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import { FaHtml5, FaMinus, FaPlus, FaLayerGroup } from "react-icons/fa";
import { BasePanel } from "../../../uiComponents/base/BasePanel";
import CollectionSyncer from "../../../uiComponents/base/CollectionSyncer";
import DList from "../../../uiComponents/base/List/DList";
import DListItem from "../../../uiComponents/base/List/DListItem";
import DLabel from "../../../uiComponents/base/Text/DLabel";
import DListItemButton from "../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import DListItemsButtonContainer from "../../../uiComponents/base/List/DListItemsButtonContainer";
import { SettingsPanelWithPropertySettings } from "../../settings/SettingsPanelWithPropertySettings";
import WebSocketManagerInstance from "../../WebSocketManager";
import { ActiveWebHelper as WebHelper } from "../../../../helpers/transport";
import ClientMediator from "../../../../ClientMediator";
import { ResizeDivider, useDragResize } from "../../../uiComponents/ResizeDivider";

// ── Module-level constants ────────────────────────────────────────────────────

const EDITABLE_DICT = [
  { key: "name", label: "UI Name", type: "string" },
  { key: "description", label: "Description", type: "textarea" },  {
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
  {
    key: "drop_token_size",
    property: true,
    label: "Default Token Size",
    type: "number",
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

const TemplateCard = React.memo(({ template, isSelected, onSelect, onDelete }) => (
  <DListItem
    isSelected={isSelected}
    onClick={() => onSelect(template)}
  >
    <DLabel>{template.name}</DLabel>
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
    borderColor="rgb(70,70,70)"
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
  const [search, setSearch] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);

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

  // ── Derived state ────────────────────────────────────────────────────────────

  const filtered = React.useMemo(
    () =>
      search.trim()
        ? templates.filter((t) =>
            t.name?.toLowerCase().includes(search.toLowerCase())
          )
        : templates,
    [templates, search]
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <BasePanel>
      <CollectionSyncer
        collection={templates}
        setCollection={setTemplates}
        commandPrefix="template"
        onAdd={(newTemplate) => setSelectedTemplate(newTemplate)}
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
          {/* Search */}
          <Box px="8px" py="6px" borderBottomWidth="1px" borderColor="rgb(70,70,70)">
            <Input
              size="xs"
              placeholder="Search templates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Box>

          {/* Scrollable list */}
          <Box flex={1} overflowY="auto" px="4px" py="4px">
            <DList mainComponent={true}>
              {filtered.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  isSelected={selectedTemplate?.id === t.id}
                  onSelect={setSelectedTemplate}
                  onDelete={handleDelete}
                />
              ))}
            </DList>
          </Box>

          {/* Pinned add button */}
          <Box px="6px" py="6px" borderTopWidth="1px" borderColor="rgb(70,70,70)">
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
