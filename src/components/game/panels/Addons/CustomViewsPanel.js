import * as React from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Text,
} from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import { FaCode } from "@react-icons/all-files/fa/FaCode";
import { FaMinus } from "@react-icons/all-files/fa/FaMinus";
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
import { SplitPane, useSplitView } from "../../../uiComponents/base/SplitPane";
import themeColors from "../../../../helpers/themeColors";

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
    borderColor={themeColors.divider}
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
  const treeRefreshRef = React.useRef(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // List and detail side by side, or one at a time when narrow.
  const split = useSplitView();
  const openView = (view) => { setSelectedView(view); split.showDetail(); };

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

  // From the toolbar's + or a folder's "+ New view here" row.
  const handleAdd = (_selected, { parentId = null } = {}) => {
    WebSocketManagerInstance.Send({
      command: "custom_panel_add",
      data: { name: "New View", description: "", content: "[]", dataCommandPrefix: "", treeParentId: parentId },
    });
  };

  const handleDelete = (view) => {
    WebSocketManagerInstance.Send({ command: "custom_panel_delete", data: view.id });
    if (selectedView?.id === view.id) { setSelectedView(null); split.showList(); }
  };

  const handleSave = (dto) => {
    WebSocketManagerInstance.Send({
      command: "custom_panel_update",
      data: { ...selectedView, ...dto },
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <BasePanel>
      <CollectionSyncer
        collection={views}
        setCollection={setViews}
        commandPrefix="custom_panel"
        onAdd={(newView) => {
          openView(newView);
          // The server files the new view in the folder tree on the next load.
          treeRefreshRef.current?.();
        }}
        onDelete={(deletedId) => {
          if (selectedView?.id === deletedId) { setSelectedView(null); split.showList(); }
        }}
      />
      <SplitPane
        split={split}
        backLabel="views"
        list={
          <Flex flex={1} minH={0} direction="column" px="4px" pt="4px">
            <DTreeList
              entityType="CustomView"
              transferKind="view"
              items={views}
              canEditFolders
              withAddItem
              onAddItem={handleAdd}
              addRowLabel="New view"
              refreshRef={treeRefreshRef}
              estimatedRowHeight={44}
              onSelect={(sel) => { if (sel?.itemRef) openView(sel.itemRef); }}
              generateItem={(v) => (
                <ViewCard
                  view={v}
                  isSelected={selectedView?.id === v.id}
                  onSelect={openView}
                  onDelete={handleDelete}
                />
              )}
            />
          </Flex>
        }
        detail={selectedView ? (
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
      />
    </BasePanel>
  );
};

export default CustomViewsPanel;
