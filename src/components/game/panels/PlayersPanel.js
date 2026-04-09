import * as React from "react";
import { Badge, Box, Circle, Flex, Text } from "@chakra-ui/react";
import { Tooltip } from "../../ui/tooltip";
import * as Dockable from "@hlorenzi/react-dockable";
import { FaCog, FaUserSlash } from "react-icons/fa";
import DList from "../../uiComponents/base/List/DList";
import DListItem from "../../uiComponents/base/List/DListItem";
import DListItemsButtonContainer from "../../uiComponents/base/List/DListItemsButtonContainer";
import DListItemButton from "../../uiComponents/base/List/ListItemDetails/DListItemButton";
import PlayerAvatar from "../../uiComponents/PlayerAvatar";
import ClientMediator from "../../../ClientMediator";
import useClientMediator from "../../uiComponents/hooks/useClientMediator";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import PlayerSettingsPanel from "../settings/PlayerSettingsPanel";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import { useDimensions } from "../../uiComponents/hooks/useDimensions";

// ─── Online indicator dot ─────────────────────────────────────────────────────

const OnlineDot = ({ isConnected }) => (
  <Tooltip content={isConnected ? "Online" : "Offline"}>
    <Circle
      width="10px"
      height="10px"
      flexShrink={0}
      bg={isConnected ? "green.400" : "red.400"}
      boxShadow={isConnected ? "0 0 6px var(--chakra-colors-green-400)" : undefined}
    />
  </Tooltip>
);

// ─── Single player row ────────────────────────────────────────────────────────

const PlayerRow = React.memo(({ entry, isAdmin, isCurrentPlayer, isOwner, horizontal, compact, state }) => {
  const { player, isConnected } = entry;
  const name = player.name ?? player.Name ?? "Unknown";

  const handleKick = () => {
    WebSocketManagerInstance.Send(CommandFactory.CreateKickPlayerCommand(player.id ?? player.Id));
  };

  const handleSettings = () => {
    Dockable.spawnFloating(state, <PlayerSettingsPanel player={player} />);
  };

  return (
    <DListItem
      withHover
      isSelected={isCurrentPlayer}
      flexProps={{ direction: horizontal ? "row" : "column", align: "center", gap: 2 }}
    >
      {/* Avatar with online indicator overlay */}
      <Box position="relative" flexShrink={0}>
        <PlayerAvatar player={player} size={compact ? 28 : 40} />
        <Box position="absolute" bottom="1px" right="1px">
          <OnlineDot isConnected={isConnected} />
        </Box>
      </Box>

      {/* Name + badges */}
      {!compact && (
        <Flex direction="column" flex="1" minW={0} gap="1px">
          <Text fontSize="xs" fontWeight="medium" noOfLines={1}>
            {name}
            {isCurrentPlayer && (
              <Text as="span" fontSize="2xs" color="gray.400" ml={1}>(you)</Text>
            )}
          </Text>
          {isOwner && (
            <Badge colorPalette="yellow" variant="subtle" fontSize="2xs" width="fit-content">
              GM
            </Badge>
          )}
        </Flex>
      )}

      {/* Admin action buttons */}
      {isAdmin && (
        <DListItemsButtonContainer>
          <DListItemButton
            label="Settings"
            icon={FaCog}
            onClick={handleSettings}
          />
          {!isCurrentPlayer && (
            <DListItemButton
              label="Kick"
              icon={FaUserSlash}
              color="red"
              onClick={handleKick}
            />
          )}
        </DListItemsButtonContainer>
      )}
    </DListItem>
  );
});

// ─── Build sorted entry list ──────────────────────────────────────────────────

const buildEntries = (allPlayers, connectedPlayers) => {
  const connectedIds = new Set((connectedPlayers ?? []).map((p) => p.id ?? p.Id));
  return (allPlayers ?? [])
    .map((p) => ({ player: p, isConnected: connectedIds.has(p.id ?? p.Id) }))
    .sort((a, b) => {
      // connected first, then by name
      if (a.isConnected !== b.isConnected) return a.isConnected ? -1 : 1;
      const na = a.player.name ?? a.player.Name ?? "";
      const nb = b.player.name ?? b.player.Name ?? "";
      return na.localeCompare(nb);
    });
};

// ─── Main panel ───────────────────────────────────────────────────────────────

export const PlayersPanel = ({ state, adminMode = false }) => {
  const [entries, setEntries]           = React.useState([]);
  const [currentPlayerId, setCurrentPlayerId] = React.useState(null);
  const [ownerId, setOwnerId]           = React.useState(null);
  const [isAdmin, setIsAdmin]           = React.useState(adminMode);

  const panelRef = React.useRef(null);
  const { width, height } = useDimensions(panelRef);

  const ctx = Dockable.useContentContext();
  ctx.setTitle(isAdmin ? "Manage Players" : "Players");

  // ── initial load ───────────────────────────────────────────────────────────

  React.useEffect(() => {
    const load = async () => {
      const [allPlayers, connected, currentPlayer, owner] = await Promise.all([
        ClientMediator.sendCommandWaitForRegisterAsync("Game", "GetPlayers",         { uniqueKey: "pp_all" },     true),
        ClientMediator.sendCommandWaitForRegisterAsync("Game", "GetConnectedPlayers", { uniqueKey: "pp_conn" },    true),
        ClientMediator.sendCommandWaitForRegisterAsync("Game", "GetCurrentPlayer",   { uniqueKey: "pp_current" }, true),
        ClientMediator.sendCommandWaitForRegisterAsync("Game", "GetOwner",           { uniqueKey: "pp_owner" },   true),
      ]);

      const currentId = currentPlayer?.id ?? currentPlayer?.Id ?? null;
      setCurrentPlayerId(currentId);
      setOwnerId(owner ?? null);

      // Elevate to admin if the current player is the game owner
      if (!adminMode) {
        setIsAdmin(currentId != null && currentId === owner);
      }

      setEntries(buildEntries(allPlayers, connected));
    };

    load().catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── live updates via ClientMediator ───────────────────────────────────────

  const handleEvent = React.useCallback((eventName, data) => {
    if (eventName !== "PlayersChanged") return;
    const { all, connected } = data;
    setEntries(buildEntries(all, connected));
  }, []);

  useClientMediator("PlayersPanel", { onEvent: handleEvent });

  // ── layout ─────────────────────────────────────────────────────────────────

  const horizontal = height >= 200;   // tall panel → vertical list (row items)
  const compact    = width  <  160;   // very narrow → avatars only

  return (
    <BasePanel direction={horizontal ? "column" : "row"} baseRef={panelRef}>
      <DList>
        {entries.map((entry) => {
          const pid = entry.player.id ?? entry.player.Id;
          return (
            <PlayerRow
              key={pid}
              entry={entry}
              isAdmin={isAdmin}
              isCurrentPlayer={pid === currentPlayerId}
              isOwner={(pid === ownerId)}
              horizontal={horizontal}
              compact={compact}
              state={state}
            />
          );
        })}
      </DList>
    </BasePanel>
  );
};

export default PlayersPanel;
