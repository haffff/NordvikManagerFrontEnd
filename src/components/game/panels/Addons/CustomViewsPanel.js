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
import { FaCode, FaMinus, FaPlus } from "react-icons/fa";
import { BasePanel } from "../../../uiComponents/base/BasePanel";
import CollectionSyncer from "../../../uiComponents/base/CollectionSyncer";
import DList from "../../../uiComponents/base/List/DList";
import DListItem from "../../../uiComponents/base/List/DListItem";
import DLabel from "../../../uiComponents/base/Text/DLabel";
import DListItemButton from "../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import DListItemsButtonContainer from "../../../uiComponents/base/List/DListItemsButtonContainer";
import { SettingsPanelWithPropertySettings } from "../../settings/SettingsPanelWithPropertySettings";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../helpers/transport";
import { ActiveWebHelper as WebHelper } from "../../../../helpers/transport";
import { ResizeDivider, useDragResize } from "../../../uiComponents/ResizeDivider";

// ── Module-level constants ────────────────────────────────────────────────────

const EDITABLE_DICT = [
  { key: "name", label: "UI Name", type: "string" },
  { key: "key", label: "Key", type: "string" },
  { key: "description", label: "Description", type: "textarea" },
  {
    key: "mainResource",
    label: "Main Resource (JavaScript)",
    type: "materialSelect",
    additionalFilter: (item) => item.mimeType === "text/html",
  },
  {
    key: "additionalResources",
    label: "Additional Resources",
    type: "materialSelect",
    multiple: true,
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

const ViewCard = React.memo(({ view, isSelected, onSelect, onDelete }) => (
  <DListItem
    isSelected={isSelected}
    onClick={() => onSelect(view)}
  >
    <DLabel>{view.name}</DLabel>
    <DListItemsButtonContainer>
      <DListItemButton
        icon={FaMinus}
        color="red"
        label="Delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(view);
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
    <Icon as={FaCode} boxSize={10} opacity={0.35} />
    <Text fontSize="sm">Select a view to edit it</Text>
  </Flex>
);

const ResourceBadges = ({ view }) => {
  const hasJs = Boolean(view.mainResource);
  const extraCount = Array.isArray(view.additionalResources)
    ? view.additionalResources.length
    : 0;
  return (
    <HStack gap="6px" flexShrink={0}>
      {hasJs && (
        <Badge colorPalette="orange" variant="subtle" fontSize="10px">
          <HStack gap="3px">
            <Icon as={FaCode} />
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
  view,
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
    <DLabel>{view.name}</DLabel>
    <ResourceBadges view={view} />
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
        label="Delete view"
        onClick={onDelete}
      />
    )}
  </Flex>
);

// ── Main component ────────────────────────────────────────────────────────────

export const CustomViewsPanel = ({ gameDataRef, state }) => {
  const [views, setViews] = React.useState([]);
  const [selectedView, setSelectedView] = React.useState(null);
  const [search, setSearch] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Resizable sidebar
  const colContainerRef = React.useRef(null);
  const { fracs, onDividerMouseDown } = useDragResize(colContainerRef, [0.35]);

  React.useEffect(() => {
    const load = async () => {
      const data = await WebHelper.getAsync("materials/getcustomwiews");
      if (data) setViews(data);
    };
    load();
  }, []);

  // Reset two-step confirm when selection changes
  React.useEffect(() => {
    setConfirmDelete(false);
  }, [selectedView?.id]);

  const ctx = Dockable.useContentContext();
  ctx.setTitle("Views");

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleAdd = () => {
    WebSocketManagerInstance.Send({
      command: "custom_panel_add",
      data: { name: "New View", description: "", content: "[]", dataCommandPrefix: "" },
    });
  };

  const handleDelete = (view) => {
    WebSocketManagerInstance.Send({ command: "custom_panel_delete", data: view.id });
    if (selectedView?.id === view.id) setSelectedView(null);
  };

  const handleSave = (dto) => {
    WebSocketManagerInstance.Send({
      command: "custom_panel_update",
      data: { ...selectedView, ...dto },
    });
  };

  // ── Derived state ────────────────────────────────────────────────────────────

  const filtered = React.useMemo(
    () =>
      search.trim()
        ? views.filter((v) =>
            v.name?.toLowerCase().includes(search.toLowerCase())
          )
        : views,
    [views, search]
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <BasePanel>
      <CollectionSyncer
        collection={views}
        setCollection={setViews}
        commandPrefix="custom_panel"
        onAdd={(newView) => setSelectedView(newView)}
        onDelete={(deletedId) => {
          if (selectedView?.id === deletedId) setSelectedView(null);
        }}
      />
      <Flex height="100%" width="100%" overflow="hidden" ref={colContainerRef}>

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
              placeholder="Search views…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Box>

          {/* Scrollable list */}
          <Box flex={1} overflowY="auto" px="4px" py="4px">
            <DList mainComponent={true}>
              {filtered.map((v) => (
                <ViewCard
                  key={v.id}
                  view={v}
                  isSelected={selectedView?.id === v.id}
                  onSelect={setSelectedView}
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
                <span>New View</span>
              </HStack>
            </Button>
          </Box>
        </Stack>

        <ResizeDivider onMouseDown={(e) => onDividerMouseDown(0, e)} />

        {/* ── Right detail pane ── */}
        <Flex direction="column" flex={1} height="100%" overflow="hidden">
          {selectedView ? (
            <>
              <RightPaneHeader
                view={selectedView}
                confirmDelete={confirmDelete}
                onDelete={() => setConfirmDelete(true)}
                onConfirmDelete={() => {
                  handleDelete(selectedView);
                  setConfirmDelete(false);
                }}
                onCancelDelete={() => setConfirmDelete(false)}
              />
              <Box flex={1} overflowY="auto" px="4px" py="4px">
                <SettingsPanelWithPropertySettings
                  withExport
                  key={selectedView.id}
                  entityName="CardModel"
                  editableKeyLabelDict={EDITABLE_DICT}
                  dto={selectedView}
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

export default CustomViewsPanel;
