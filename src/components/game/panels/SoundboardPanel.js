import * as React from "react";
import { Box, Button, Flex, HStack, Icon, IconButton, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import { FaChevronLeft } from "@react-icons/all-files/fa/FaChevronLeft";
import { FaChevronRight } from "@react-icons/all-files/fa/FaChevronRight";
import { FaEdit } from "@react-icons/all-files/fa/FaEdit";
import { FaMinus } from "@react-icons/all-files/fa/FaMinus";
import { FaMusic } from "@react-icons/all-files/fa/FaMusic";
import { FaPlus } from "@react-icons/all-files/fa/FaPlus";
import { FaRedo } from "@react-icons/all-files/fa/FaRedo";
import { FaStop } from "@react-icons/all-files/fa/FaStop";
import { FaVolumeUp } from "@react-icons/all-files/fa/FaVolumeUp";
import { toaster } from "../../ui/toaster";
import { Tooltip } from "../../ui/tooltip";
import { playingSounds, usePlayingSounds } from "../../../helpers/playingSounds";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import Subscribable from "../../uiComponents/base/Subscribable";
import DTreeList from "../../uiComponents/treeList/DTreeList";
import DListItem from "../../uiComponents/base/List/DListItem";
import DLabel from "../../uiComponents/base/Text/DLabel";
import DListItemButton from "../../uiComponents/base/List/ListItemDetails/DListItemButton";
import VolumeSlider from "../../uiComponents/VolumeSlider";
import DListItemsButtonContainer from "../../uiComponents/base/List/DListItemsButtonContainer";
import SettingsPanel from "../settings/SettingsPanel";
import ClientMediator from "../../../ClientMediator";
import { usePermissions } from "../../../contexts/PermissionsContext";
import { useDragResize } from "../../uiComponents/ResizeDivider";
import themeColors from "../../../helpers/themeColors";

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

const BoardCard = React.memo(({ board, isSelected, onSelect, onDelete, onVolume }) => (
  <DListItem isSelected={isSelected} onClick={() => onSelect(board)}>
    <DLabel>{board.name}</DLabel>
    <VolumeSlider label={`Volume of ${board.name}`} value={board.volume ?? 1} onCommit={(volume) => onVolume?.(board, volume)} />
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

// How far a playing sound is (0..1), read off its audio element while it plays.
const useSoundProgress = (resourceId) => {
  const [progress, setProgress] = React.useState(0);
  React.useEffect(() => {
    const read = () => {
      const audio = playingSounds.get(resourceId);
      setProgress(audio?.duration ? Math.min(1, audio.currentTime / audio.duration) : 0);
    };
    read();
    const timer = setInterval(read, 250);
    return () => clearInterval(timer);
  }, [resourceId]);
  return progress;
};

const SoundProgress = ({ resource }) => {
  const progress = useSoundProgress(resource.id);
  return (
    <Box
      role="progressbar"
      aria-label={resource.name}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      position="absolute"
      left={0}
      bottom={0}
      height="3px"
      width="100%"
      bg={themeColors.controlStrong}
    >
      <Box height="100%" width={`${progress * 100}%`} bg={themeColors.accent} />
    </Box>
  );
};

// One button per sound: a click plays it, a click while it plays stops it. The loop button
// (top right) makes it repeat until stopped, from its next play.
const SoundTile = React.memo(({ resource, playing, looped, onPlay, onStop, onToggleLoop }) => (
  <Box
    position="relative"
    borderWidth="1px"
    borderColor={playing ? themeColors.accent : "whiteAlpha.200"}
    bg={playing ? themeColors.surfaceRaised : undefined}
    borderRadius="md"
    overflow="hidden"
  >
    <Button
      variant="ghost"
      width="100%"
      height="56px"
      pr="30px"
      aria-label={`${playing ? "Stop" : "Play"} ${resource.name}`}
      onClick={() => (playing ? onStop(resource) : onPlay(resource))}
    >
      <Flex align="center" gap="6px" minW={0}>
        <Icon as={playing ? FaStop : FaMusic} color={playing ? themeColors.accent : undefined} flexShrink={0} />
        <Text fontSize="xs" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
          {resource.name}
        </Text>
      </Flex>
    </Button>
    <Tooltip openDelay={300} content={looped ? "Loops until stopped" : "Plays once"}>
      <IconButton
        aria-label={`Loop ${resource.name}`}
        aria-pressed={looped}
        size="2xs"
        variant="ghost"
        position="absolute"
        top="2px"
        right="2px"
        color={looped ? themeColors.accent : themeColors.textMuted}
        onClick={() => onToggleLoop(resource)}
      >
        <Icon as={FaRedo} />
      </IconButton>
    </Tooltip>
    {playing && <SoundProgress resource={resource} />}
  </Box>
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
        bg={themeColors.controlStrong}
        _hover={{ bg: themeColors.accent }}
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
      bg={themeColors.control}
      borderWidth="1px"
      borderColor={themeColors.controlBorder}
      _hover={{ bg: themeColors.controlHover }}
      onClick={onToggle}
      zIndex={1}
    >
      <Icon as={isCollapsed ? FaChevronRight : FaChevronLeft} boxSize="10px" />
    </Button>
  </Box>
);

const RightPaneHeader = ({ board, viewMode, onToggleView, onStopAll, confirmDelete, onDelete, onConfirmDelete, onCancelDelete }) => (
  <Flex align="center" px="12px" py="8px" borderBottomWidth="1px" borderColor={themeColors.divider} gap="10px" flexShrink={0}>
    <DLabel>{board.name}</DLabel>
    <Flex grow={1} />
    <Button size="xs" variant="outline" onClick={onStopAll} aria-label="Stop all sounds">
      <Icon as={FaStop} />
      Stop all
    </Button>
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
  const { canEditGame } = usePermissions();
  const [boards, setBoards] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState(null);
  const treeRefreshRef = React.useRef(null);
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

  // After something changed: reload boards and the folder tree (the server files a new
  // board in the tree on its next load).
  const reloadAll = React.useCallback(async () => {
    await loadBoards();
    treeRefreshRef.current?.();
  }, [loadBoards]);

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
    await reloadAll();
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
    await reloadAll();
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
    await reloadAll();
  };

  // Do not optimistically play locally — wait for the resulting sound_play broadcast,
  // same as PlaylistsPanel waits for playlist_notify before refetching.
  // From the selected soundboard, so its volume applies.
  const handlePlay = (resource) => {
    ClientMediator.sendCommandAsync("Playlist", "PlaySound", { resourceId: resource.id, soundboardId: selectedBoard?.id });
  };

  const handleVolume = async (board, volume) => {
    const { status, body } = await ClientMediator.sendCommandAsync("Playlist", "SetVolume", { playlist: board, volume }) ?? {};
    if (status < 200 || status >= 300) {
      toaster.create({ title: "Failed to change the volume", description: body?.error, type: "error", duration: 5000 });
      return;
    }
    await reloadAll();
  };

  const handleStop = (resource) => {
    ClientMediator.sendCommandAsync("Playlist", "StopSound", { resourceId: resource.id });
  };

  const handleStopAll = () => {
    ClientMediator.sendCommandAsync("Playlist", "StopAllSounds", {});
  };

  const handleToggleLoop = async (resource) => {
    const looped = selectedBoard.loopedResourceIds ?? [];
    const resourceIds = looped.includes(resource.id) ? looped.filter((id) => id !== resource.id) : [...looped, resource.id];
    const { status, body } = await ClientMediator.sendCommandAsync("Playlist", "SetLoopedSounds", { playlist: selectedBoard, resourceIds }) ?? {};
    if (status < 200 || status >= 300) {
      toaster.create({ title: "Failed to change the loop", description: body?.error, type: "error", duration: 5000 });
      return;
    }
    await loadBoards();
  };

  // ── Derived state ────────────────────────────────────────────────────────────

  const sounds = selectedBoard?.resources ?? [];
  const playing = usePlayingSounds();

  if (!canEditGame) {
    return (
      <BasePanel>
        <EmptyState message="Only players who can edit the game can manage the soundboard." />
      </BasePanel>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <BasePanel>
      {/* Sound play/stop events are frequent: only real changes (playlist_notify) refresh the tree. */}
      <Subscribable
        commandPrefix="playlist"
        onMessage={(m) => (m?.command === "playlist_notify" ? reloadAll() : loadBoards())}
      />
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
          {/* Folder tree (with its own search) */}
          <Flex flex={1} minH={0} direction="column" px="4px" pt="4px">
            <DTreeList
              entityType="Soundboard"
              items={boards}
              canEditFolders={canEditGame}
              refreshRef={treeRefreshRef}
              estimatedRowHeight={44}
              onSelect={(sel) => { if (sel?.itemRef) setSelectedId(sel.itemRef.id); }}
              generateItem={(b) => (
                <BoardCard
                  board={b}
                  isSelected={selectedId === b.id}
                  onSelect={(board) => setSelectedId(board.id)}
                  onDelete={handleDelete}
                  onVolume={handleVolume}
                />
              )}
            />
          </Flex>

          <Box px="6px" py="6px" borderTopWidth="1px" borderColor={themeColors.divider}>
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
                onStopAll={handleStopAll}
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
                      <SoundTile
                        key={resource.id}
                        resource={resource}
                        playing={playing.has(resource.id)}
                        looped={(selectedBoard.loopedResourceIds ?? []).includes(resource.id)}
                        onPlay={handlePlay}
                        onStop={handleStop}
                        onToggleLoop={handleToggleLoop}
                      />
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
