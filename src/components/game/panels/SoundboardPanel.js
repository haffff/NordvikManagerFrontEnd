import * as React from "react";
import { Box, Button, Flex, HStack, Icon, Input, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import { FaChevronLeft, FaChevronRight, FaEdit, FaMinus, FaMusic, FaPlus, FaStop, FaVolumeUp } from "react-icons/fa";
import { toaster } from "../../ui/toaster";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import Subscribable from "../../uiComponents/base/Subscribable";
import DList from "../../uiComponents/base/List/DList";
import DListItem from "../../uiComponents/base/List/DListItem";
import DLabel from "../../uiComponents/base/Text/DLabel";
import DListItemButton from "../../uiComponents/base/List/ListItemDetails/DListItemButton";
import DListItemsButtonContainer from "../../uiComponents/base/List/DListItemsButtonContainer";
import SettingsPanel from "../settings/SettingsPanel";
import ClientMediator from "../../../ClientMediator";
import { usePermissions } from "../../../contexts/PermissionsContext";
import { useDragResize } from "../../uiComponents/ResizeDivider";

// ── Module-level constants ────────────────────────────────────────────────────

// A Soundboard is a Playlist row tagged Kind=1 (Soundboard) instead of Kind=0
// (Music) — reuses the same CRUD backend as PlaylistsPanel, just filtered/tagged
// differently. Mode/Shuffle/Repeat are irrelevant here (no sequencing, every sound
// is a one-shot) so they're omitted from this form and sent as harmless defaults.
const EDITABLE_DICT = [
  { key: "name", label: "Name", type: "string", required: true },
  { key: "description", label: "Description", type: "textarea" },
  {
    key: "resourceIds",
    label: "Sounds",
    type: "materialSelect",
    multiple: true,
    additionalFilter: (item) => item.mimeType?.startsWith("audio"),
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

const BoardCard = React.memo(({ board, isSelected, onSelect, onDelete }) => (
  <DListItem isSelected={isSelected} onClick={() => onSelect(board)}>
    <DLabel>{board.name}</DLabel>
    <DListItemsButtonContainer>
    </DListItemsButtonContainer>
  </DListItem>
));

const EmptyState = ({ message = "Select a soundboard to play or edit it" }) => (
  <Flex direction="column" align="center" justify="center" gap="12px" height="100%" color="gray.500" userSelect="none">
    <Icon as={FaVolumeUp} boxSize={10} opacity={0.35} />
    <Text fontSize="sm">{message}</Text>
  </Flex>
);

const SoundTile = React.memo(({ resource, onPlay, onStop }) => (
  <Flex
    direction="column"
    align="center"
    justify="center"
    gap="6px"
    p="10px"
    borderWidth="1px"
    borderColor="whiteAlpha.200"
    borderRadius="md"
    position="relative"
  >
    <Button variant="outline" size="sm" width="100%" onClick={() => onPlay(resource)}>
      <Flex align="center" gap="6px">
        <Icon as={FaMusic} />
        <Text fontSize="xs" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
          {resource.name}
        </Text>
      </Flex>
    </Button>
    <DListItemButton icon={FaStop} label="Stop" size="xs" onClick={() => onStop(resource)} />
  </Flex>
));

// A resize divider with a collapse/expand toggle riding on it — the idiomatic
// "collapse sidebar" affordance (button lives on the boundary between panes, not
// floating in the list's own header where it reads as an unrelated nav control).
const CollapsibleDivider = ({ isCollapsed, onToggle, onMouseDown }) => (
  <Box position="relative" flexShrink={0} width={isCollapsed ? "14px" : "4px"} height="100%">
    {!isCollapsed && (
      <Box
        position="absolute"
        inset={0}
        cursor="col-resize"
        bg="rgb(65,65,65)"
        _hover={{ bg: "rgb(100,150,230)" }}
        onMouseDown={onMouseDown}
      />
    )}
    <Button
      size="2xs"
      position="absolute"
      top="50%"
      left="50%"
      transform="translate(-50%, -50%)"
      minW="16px"
      width="16px"
      height="32px"
      px={0}
      borderRadius="sm"
      bg="rgb(45,45,45)"
      borderWidth="1px"
      borderColor="rgb(90,90,90)"
      _hover={{ bg: "rgb(70,70,70)" }}
      onClick={onToggle}
      zIndex={1}
    >
      <Icon as={isCollapsed ? FaChevronRight : FaChevronLeft} boxSize="10px" />
    </Button>
  </Box>
);

const RightPaneHeader = ({ board, viewMode, onToggleView, confirmDelete, onDelete, onConfirmDelete, onCancelDelete }) => (
  <Flex align="center" px="12px" py="8px" borderBottomWidth="1px" borderColor="rgb(70,70,70)" gap="10px" flexShrink={0}>
    <DLabel>{board.name}</DLabel>
    <Flex grow={1} />
    <DListItemButton
      icon={FaEdit}
      color={viewMode === "edit" ? "blue.300" : undefined}
      label={viewMode === "edit" ? "Back to play view" : "Edit sounds"}
      onClick={onToggleView}
    />
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
      <DListItemButton icon={FaMinus} color="red" label="Delete soundboard" onClick={onDelete} />
    )}
  </Flex>
);

// ── Main component ────────────────────────────────────────────────────────────

export const SoundboardPanel = () => {
  const { isGM } = usePermissions();
  const [boards, setBoards] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState(null);
  const [search, setSearch] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [viewMode, setViewMode] = React.useState("play"); // "play" | "edit"
  const [isListCollapsed, setIsListCollapsed] = React.useState(false);

  const colContainerRef = React.useRef(null);
  const { fracs, onDividerMouseDown } = useDragResize(colContainerRef, [0.35]);

  const ctx = Dockable.useContentContext();
  ctx.setTitle("Soundboard");

  const loadBoards = React.useCallback(async () => {
    const data = await ClientMediator.sendCommandAsync("Playlist", "GetPlaylists", { kind: 1 });
    if (data) setBoards(data);
  }, []);

  React.useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  // Reset two-step confirm and go back to the play view whenever selection changes.
  React.useEffect(() => {
    setConfirmDelete(false);
    setViewMode("play");
  }, [selectedId]);

  const selectedBoard = boards.find((b) => b.id === selectedId) ?? null;

  const editorDto = React.useMemo(() => {
    if (!selectedBoard) return null;
    return {
      id: selectedBoard.id,
      name: selectedBoard.name,
      description: selectedBoard.description,
      resourceIds: (selectedBoard.resources ?? []).map((r) => r.id),
    };
  }, [selectedBoard]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    const { status, body } = await ClientMediator.sendCommandAsync("Playlist", "AddPlaylist", {
      Name: "New Soundboard",
      Description: "",
      Mode: 0,
      Shuffle: false,
      Repeat: true,
      Kind: 1,
      ResourceIds: [],
    });
    if (status < 200 || status >= 300) {
      toaster.create({ title: "Failed to create soundboard", description: body?.error, type: "error", duration: 5000 });
      return;
    }
    await loadBoards();
    if (body?.id) setSelectedId(body.id);
  };

  // RemovePlaylist's success path always returns the CommandResponse enum as a bare
  // number (0 Ok / 5 NoChange) — same contract PlaylistsPanel relies on.
  const handleDelete = async (board) => {
    const body = await ClientMediator.sendCommandAsync("Playlist", "RemovePlaylist", board.id);
    if (typeof body !== "number") {
      toaster.create({ title: "Failed to delete soundboard", description: body?.error, type: "error", duration: 5000 });
      return;
    }
    if (selectedId === board.id) setSelectedId(null);
    await loadBoards();
  };

  const handleSave = async (changes) => {
    if (!editorDto) return;
    const merged = { ...editorDto, ...changes };
    const { status, body } = await ClientMediator.sendCommandAsync("Playlist", "UpdatePlaylist", {
      Id: merged.id,
      Name: merged.name,
      Description: merged.description ?? "",
      Mode: 0,
      Shuffle: false,
      Repeat: true,
      Kind: 1,
      ResourceIds: merged.resourceIds ?? [],
    });
    if (status < 200 || status >= 300) {
      toaster.create({ title: "Failed to save soundboard", description: body?.error, type: "error", duration: 5000 });
      return;
    }
    await loadBoards();
  };

  // Do not optimistically play locally — wait for the resulting sound_play broadcast,
  // same as PlaylistsPanel waits for playlist_notify before refetching.
  const handlePlay = (resource) => {
    ClientMediator.sendCommandAsync("Playlist", "PlaySound", { resourceId: resource.id });
  };

  const handleStop = (resource) => {
    ClientMediator.sendCommandAsync("Playlist", "StopSound", { resourceId: resource.id });
  };

  // ── Derived state ────────────────────────────────────────────────────────────

  const filtered = React.useMemo(
    () => (search.trim() ? boards.filter((b) => b.name?.toLowerCase().includes(search.toLowerCase())) : boards),
    [boards, search]
  );

  const sounds = selectedBoard?.resources ?? [];

  if (!isGM) {
    return (
      <BasePanel>
        <EmptyState message="Only the GM can manage the soundboard." />
      </BasePanel>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <BasePanel>
      <Subscribable commandPrefix="playlist" onMessage={() => loadBoards()} />
      <Flex height="100%" width="100%" overflow="hidden" ref={colContainerRef}>
        {/* ── Left list pane ── */}
        <Stack
          width={`${fracs[0] * 100}%`}
          flexShrink={0}
          height="100%"
          overflow="hidden"
          gap={0}
          display={isListCollapsed ? "none" : "flex"}
        >
          <Box px="8px" py="6px" borderBottomWidth="1px" borderColor="rgb(70,70,70)">
            <Input
              size="xs"
              placeholder="Search soundboards…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Box>

          <Box flex={1} overflowY="auto" px="4px" py="4px">
            <DList mainComponent={true}>
              {filtered.map((b) => (
                <BoardCard
                  key={b.id}
                  board={b}
                  isSelected={selectedId === b.id}
                  onSelect={(board) => setSelectedId(board.id)}
                  onDelete={handleDelete}
                />
              ))}
            </DList>
          </Box>

          <Box px="6px" py="6px" borderTopWidth="1px" borderColor="rgb(70,70,70)">
            <Button variant="outline" size="sm" width="100%" onClick={handleAdd}>
              <HStack gap="6px">
                <Icon as={FaPlus} />
                <span>New Soundboard</span>
              </HStack>
            </Button>
          </Box>
        </Stack>

        <CollapsibleDivider
          isCollapsed={isListCollapsed}
          onToggle={() => setIsListCollapsed((c) => !c)}
          onMouseDown={(e) => onDividerMouseDown(0, e)}
        />

        {/* ── Right detail pane ── */}
        <Flex direction="column" flex={1} height="100%" overflow="hidden">
          {selectedBoard && editorDto ? (
            <>
              <RightPaneHeader
                board={selectedBoard}
                viewMode={viewMode}
                onToggleView={() => setViewMode((v) => (v === "edit" ? "play" : "edit"))}
                confirmDelete={confirmDelete}
                onDelete={() => setConfirmDelete(true)}
                onConfirmDelete={() => {
                  handleDelete(selectedBoard);
                  setConfirmDelete(false);
                }}
                onCancelDelete={() => setConfirmDelete(false)}
              />
              <Box flex={1} overflowY="auto" p="10px">
                {viewMode === "edit" ? (
                  <SettingsPanel
                    key={selectedBoard.id}
                    dto={editorDto}
                    editableKeyLabelDict={EDITABLE_DICT}
                    onSave={handleSave}
                  />
                ) : sounds.length === 0 ? (
                  <EmptyState message="No sounds in this board yet — click the edit icon to add some." />
                ) : (
                  <SimpleGrid columns={3} gap="10px">
                    {sounds.map((resource) => (
                      <SoundTile key={resource.id} resource={resource} onPlay={handlePlay} onStop={handleStop} />
                    ))}
                  </SimpleGrid>
                )}
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

export default SoundboardPanel;
