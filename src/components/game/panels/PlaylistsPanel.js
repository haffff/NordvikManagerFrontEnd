import * as React from "react";
import { Box, Button, Flex, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import { FaChevronLeft, FaChevronRight, FaMinus, FaMusic, FaPause, FaPlay, FaPlus, FaStop } from "react-icons/fa";
import { toaster } from "../../ui/toaster";
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

// PlaybackMode is a numeric enum on the backend (System.Text.Json default, no
// JsonStringEnumConverter configured) — 0 = Sequential, 1 = Concurrent.
const EDITABLE_DICT = [
  { key: "name", label: "Name", type: "string", required: true },
  { key: "description", label: "Description", type: "textarea" },
  {
    key: "mode",
    label: "Playback Mode",
    type: "select",
    options: [
      { value: 0, label: "Sequential" },
      { value: 1, label: "Concurrent" },
    ],
  },
  { key: "shuffle", label: "Shuffle (Sequential only)", type: "boolean" },
  { key: "repeat", label: "Repeat", type: "boolean" },
  {
    key: "resourceIds",
    label: "Tracks",
    type: "materialSelect",
    multiple: true,
    additionalFilter: (item) => item.mimeType?.startsWith("audio"),
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

const PlaylistCard = React.memo(({ playlist, isSelected, playbackStatus, onSelect, onPlay, onPause, onStop, onDelete, onVolume }) => (
  <DListItem isSelected={isSelected} onClick={() => onSelect(playlist)}>
    <DLabel>{playlist.name}</DLabel>
    {playbackStatus && (
      <Text fontSize="10px" color={playbackStatus === "playing" ? "green.400" : "yellow.400"} ml="6px">
        {playbackStatus === "playing" ? "▶ playing" : "⏸ paused"}
      </Text>
    )}
    <VolumeSlider label={`Volume of ${playlist.name}`} value={playlist.volume ?? 1} onCommit={(volume) => onVolume?.(playlist, volume)} />
    <DListItemsButtonContainer>
      <DListItemButton
        icon={FaPlay}
        color={playbackStatus === "playing" ? "green.400" : undefined}
        label="Play / Resume"
        onClick={(e) => {
          e.stopPropagation();
          onPlay(playlist);
        }}
      />
      <DListItemButton
        icon={FaPause}
        color={playbackStatus === "paused" ? "yellow.400" : undefined}
        label="Pause"
        hidden={!playbackStatus}
        onClick={(e) => {
          e.stopPropagation();
          onPause(playlist);
        }}
      />
      <DListItemButton
        icon={FaStop}
        label="Stop"
        hidden={!playbackStatus}
        onClick={(e) => {
          e.stopPropagation();
          onStop(playlist);
        }}
      />
    </DListItemsButtonContainer>
  </DListItem>
));

const EmptyState = ({ message = "Select a playlist to edit it" }) => (
  <Flex
    direction="column"
    align="center"
    justify="center"
    gap="12px"
    height="100%"
    color="gray.500"
    userSelect="none"
  >
    <Icon as={FaMusic} boxSize={10} opacity={0.35} />
    <Text fontSize="sm">{message}</Text>
  </Flex>
);

// A resize divider with a collapse/expand toggle riding on it — mirrors
// SoundboardPanel's CollapsibleDivider but collapses the pane on the opposite side
// (details, to the right, instead of the list, to the left), so the chevron
// direction is reversed: pointing right means "collapse rightward", left means
// "expand back out to the left".
const CollapsibleDivider = ({ isCollapsed, onToggle, onMouseDown }) => (
  <Box position="relative" flexShrink={0} width={isCollapsed ? "14px" : "4px"} height="100%">
    {!isCollapsed && (
      <Box
        position="absolute"
        inset={0}
        cursor="col-resize"
        bg={themeColors.controlStrong}
        _hover={{ bg: themeColors.accentBlue }}
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
      <Icon as={isCollapsed ? FaChevronLeft : FaChevronRight} boxSize="10px" />
    </Button>
  </Box>
);

const RightPaneHeader = ({ playlist, confirmDelete, onDelete, onConfirmDelete, onCancelDelete }) => (
  <Flex
    align="center"
    px="12px"
    py="8px"
    borderBottomWidth="1px"
    borderColor={themeColors.divider}
    gap="10px"
    flexShrink={0}
  >
    <DLabel>{playlist.name}</DLabel>
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
      <DListItemButton icon={FaMinus} color="red" label="Delete playlist" onClick={onDelete} />
    )}
  </Flex>
);

// ── Main component ────────────────────────────────────────────────────────────

export const PlaylistsPanel = () => {
  const { isGM } = usePermissions();
  const [playlists, setPlaylists] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState(null);
  const treeRefreshRef = React.useRef(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  // { [playlistId]: "playing" | "paused" } — display-only, fed by playback broadcasts.
  // PlaybackManager (Game.js) owns the actual audio; this panel only reflects status.
  const [playbackStatus, setPlaybackStatus] = React.useState({});
  const [isDetailsCollapsed, setIsDetailsCollapsed] = React.useState(false);

  const colContainerRef = React.useRef(null);
  const { fracs, onDividerMouseDown } = useDragResize(colContainerRef, [0.35]);

  const ctx = Dockable.useContentContext();
  ctx.setTitle("Playlists");

  const loadPlaylists = React.useCallback(async () => {
    const data = await ClientMediator.sendCommandAsync("Playlist", "GetPlaylists", { kind: 0 });
    if (data) setPlaylists(data);
  }, []);

  // After something changed: reload playlists and the folder tree (the server files a new
  // playlist in the tree on its next load).
  const reloadAll = React.useCallback(async () => {
    await loadPlaylists();
    treeRefreshRef.current?.();
  }, [loadPlaylists]);

  React.useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  // Initial playback status, for button/badge state — actual audio playback is owned by
  // PlaybackManager (Game.js), this is display-only.
  React.useEffect(() => {
    ClientMediator.sendCommandAsync("Playlist", "GetCurrentPlayback").then((data) => {
      if (!Array.isArray(data)) return;
      const next = {};
      data.forEach((s) => { next[s.playlistId] = s.isPaused ? "paused" : "playing"; });
      setPlaybackStatus(next);
    });
  }, []);

  // Reset two-step confirm when selection changes
  React.useEffect(() => {
    setConfirmDelete(false);
  }, [selectedId]);

  const handlePlaybackEvent = React.useCallback((event) => {
    const data = event?.data ?? {};
    switch (event?.command) {
      case "playlist_play":
        setPlaybackStatus((prev) => ({ ...prev, [data.playlistId]: "playing" }));
        break;
      case "playlist_pause":
        setPlaybackStatus((prev) => ({ ...prev, [data.playlistId]: "paused" }));
        break;
      case "playlist_stop":
        setPlaybackStatus((prev) => {
          const next = { ...prev };
          delete next[data.playlistId];
          return next;
        });
        break;
      case "playlist_track_change":
        setPlaybackStatus((prev) => ({ ...prev, [data.playlistId]: "playing" }));
        break;
      default:
        break;
    }
  }, []);

  const selectedPlaylist = playlists.find((p) => p.id === selectedId) ?? null;

  const editorDto = React.useMemo(() => {
    if (!selectedPlaylist) return null;
    return {
      id: selectedPlaylist.id,
      name: selectedPlaylist.name,
      description: selectedPlaylist.description,
      mode: selectedPlaylist.mode,
      shuffle: selectedPlaylist.shuffle,
      repeat: selectedPlaylist.repeat,
      resourceIds: (selectedPlaylist.resources ?? []).map((r) => r.id),
    };
  }, [selectedPlaylist]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    const { status, body } = await ClientMediator.sendCommandAsync("Playlist", "AddPlaylist", {
      Name: "New Playlist",
      Description: "",
      Mode: 0,
      Shuffle: false,
      Repeat: true,
      Kind: 0,
      ResourceIds: [],
    });
    if (status < 200 || status >= 300) {
      toaster.create({ title: "Failed to create playlist", description: body?.error, type: "error", duration: 5000 });
      return;
    }
    await reloadAll();
    if (body?.id) setSelectedId(body.id);
  };

  const handlePlay = async (playlist) => {
    const { status, body } = await ClientMediator.sendCommandAsync("Playlist", "Play", { playlistId: playlist.id });
    if (status < 200 || status >= 300) {
      toaster.create({ title: "Failed to play playlist", description: body?.error, type: "error", duration: 5000 });
    }
  };

  const handlePause = async (playlist) => {
    const { status, body } = await ClientMediator.sendCommandAsync("Playlist", "Pause", { playlistId: playlist.id });
    if (status < 200 || status >= 300) {
      toaster.create({ title: "Failed to pause playlist", description: body?.error, type: "error", duration: 5000 });
    }
  };

  const handleStopPlayback = async (playlist) => {
    const { status, body } = await ClientMediator.sendCommandAsync("Playlist", "Stop", { playlistId: playlist.id });
    if (status < 200 || status >= 300) {
      toaster.create({ title: "Failed to stop playlist", description: body?.error, type: "error", duration: 5000 });
    }
  };

  // RemovePlaylist's success path always returns the CommandResponse enum as a bare
  // number (0 Ok / 5 NoChange). Anything else — including `undefined`, which is what
  // the plain-400 "not a player in this game" case yields — is treated as a failure.
  const handleDelete = async (playlist) => {
    const body = await ClientMediator.sendCommandAsync("Playlist", "RemovePlaylist", playlist.id);
    if (typeof body !== "number") {
      toaster.create({ title: "Failed to delete playlist", description: body?.error, type: "error", duration: 5000 });
      return;
    }
    if (selectedId === playlist.id) setSelectedId(null);
    setPlaybackStatus((prev) => {
      const next = { ...prev };
      delete next[playlist.id];
      return next;
    });
    await reloadAll();
  };

  // Saved for everyone; heard at once while the playlist plays.
  const handleVolume = async (playlist, volume) => {
    const { status, body } = await ClientMediator.sendCommandAsync("Playlist", "SetVolume", { playlist, volume }) ?? {};
    if (status < 200 || status >= 300) {
      toaster.create({ title: "Failed to change the volume", description: body?.error, type: "error", duration: 5000 });
      return;
    }
    await reloadAll();
  };

  const handleSave = async (changes) => {
    if (!editorDto) return;
    const merged = { ...editorDto, ...changes };
    const { status, body } = await ClientMediator.sendCommandAsync("Playlist", "UpdatePlaylist", {
      Id: merged.id,
      Name: merged.name,
      Description: merged.description ?? "",
      // Chakra's SelectRoot emits string values (e.g. "1") via onValueChange — the backend
      // enum requires a JSON number, so coerce regardless of what shape it arrives in.
      Mode: Number(merged.mode ?? 0),
      Shuffle: merged.shuffle ?? false,
      Repeat: merged.repeat ?? true,
      Kind: 0,
      ResourceIds: merged.resourceIds ?? [],
    });
    if (status < 200 || status >= 300) {
      toaster.create({ title: "Failed to save playlist", description: body?.error, type: "error", duration: 5000 });
      return;
    }
    await reloadAll();
  };

  // ── Derived state ────────────────────────────────────────────────────────────

  if (!isGM) {
    return (
      <BasePanel>
        <EmptyState message="Only the GM can manage playlists." />
      </BasePanel>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <BasePanel>
      {/* Only playlist_notify (add/update/delete) should trigger a refetch — playback
          broadcasts (play/pause/stop/track_change) are frequent and already tracked
          locally via handlePlaybackEvent below, so refetching on those would be wasteful. */}
      <Subscribable commandPrefix="playlist_notify" onMessage={() => reloadAll()} />
      <Subscribable commandPrefix="playlist" onMessage={handlePlaybackEvent} />
      <Flex height="100%" width="100%" overflow="hidden" ref={colContainerRef}>
        {/* ── Left list pane ── */}
        <Stack
          width={isDetailsCollapsed ? "auto" : `${fracs[0] * 100}%`}
          flexGrow={isDetailsCollapsed ? 1 : 0}
          flexShrink={0}
          height="100%"
          overflow="hidden"
          gap={0}
        >
          {/* Folder tree (with its own search) */}
          <Flex flex={1} minH={0} direction="column" px="4px" pt="4px">
            <DTreeList
              entityType="Playlist"
              items={playlists}
              canEditFolders={isGM}
              refreshRef={treeRefreshRef}
              estimatedRowHeight={44}
              onSelect={(sel) => { if (sel?.itemRef) setSelectedId(sel.itemRef.id); }}
              generateItem={(p) => (
                <PlaylistCard
                  playlist={p}
                  isSelected={selectedId === p.id}
                  playbackStatus={playbackStatus[p.id]}
                  onSelect={(playlist) => setSelectedId(playlist.id)}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onStop={handleStopPlayback}
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
                <span>New Playlist</span>
              </HStack>
            </Button>
          </Box>
        </Stack>

        <CollapsibleDivider
          isCollapsed={isDetailsCollapsed}
          onToggle={() => setIsDetailsCollapsed((c) => !c)}
          onMouseDown={(e) => onDividerMouseDown(0, e)}
        />

        {/* ── Right detail pane ── */}
        <Flex
          direction="column"
          flex={1}
          height="100%"
          overflow="hidden"
          display={isDetailsCollapsed ? "none" : "flex"}
        >
          {selectedPlaylist && editorDto ? (
            <>
              <RightPaneHeader
                playlist={selectedPlaylist}
                confirmDelete={confirmDelete}
                onDelete={() => setConfirmDelete(true)}
                onConfirmDelete={() => {
                  handleDelete(selectedPlaylist);
                  setConfirmDelete(false);
                }}
                onCancelDelete={() => setConfirmDelete(false)}
              />
              <Box flex={1} overflowY="auto" px="4px" py="4px">
                <SettingsPanel
                  key={selectedPlaylist.id}
                  dto={editorDto}
                  editableKeyLabelDict={EDITABLE_DICT}
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

export default PlaylistsPanel;
