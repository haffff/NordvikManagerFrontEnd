import * as React from "react";
import { Badge, Box, Button, Flex, HStack, Heading, Text } from "@chakra-ui/react";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import WebSocketManagerInstance from "../WebSocketManager";
import Subscribable from "../../uiComponents/base/Subscribable";
import WebHelper from "../../../helpers/WebHelper";
import UtilityHelper from "../../../helpers/UtilityHelper";
import DList from "../../uiComponents/base/List/DList";
import DListItem from "../../uiComponents/base/List/DListItem";
import ClientMediator from "../../../ClientMediator";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import {
  SelectRoot,
  SelectTrigger,
  SelectValueText,
  SelectContent,
  SelectItem,
} from "../../ui/select";
import { createListCollection } from "@chakra-ui/react";
import { toaster } from "../../ui/toaster";

// ─── Constants ────────────────────────────────────────────────────────────────

const PERMISSION_LEVELS = [
  { name: "Not set",  value: "-1", description: "Permission has not been explicitly set — falls back to game defaults." },
  { name: "None",     value: "0",  description: "Player cannot see or interact with this element." },
  { name: "See",      value: "1",  description: "Player can see this element but cannot interact with it." },
  { name: "Control",  value: "4",  description: "Player can control / execute actions on this element, but cannot edit or remove it." },
  { name: "Edit",     value: "7",  description: "Player can edit this element but cannot remove it." },
  { name: "All",      value: "31", description: "Player has full control — see, control, edit, and remove." },
];

const ROLES_COLLECTION = createListCollection({ items: PERMISSION_LEVELS });

// ─── Player permission row ────────────────────────────────────────────────────

const PlayerPermissionRow = React.memo(({ player, isCurrentPlayer, onChange }) => {
  const valueAsString = String(player.permission ?? -1);

  return (
    <DListItem padding="10px" isSelected={isCurrentPlayer}>
      <Heading size="xs" width="40%" flexShrink={0}>
        {player.name}
        {isCurrentPlayer && (
          <Text as="span" fontSize="xs" color="gray.400" ml={2}>(you)</Text>
        )}
      </Heading>
      <Box flex="1">
        <SelectRoot
          collection={ROLES_COLLECTION}
          value={[valueAsString]}
          onValueChange={(e) => onChange(player.id, parseInt(e.value[0], 10))}
          size="sm"
        >
          <SelectTrigger>
            <SelectValueText placeholder="Select permission">
              {(items) => {
                const match = PERMISSION_LEVELS.find((r) => r.value === valueAsString);
                return <>{match ? match.name : "Not set"}</>;
              }}
            </SelectValueText>
          </SelectTrigger>
          <SelectContent zIndex={9999}>
            {PERMISSION_LEVELS.map((level) => (
              <SelectItem item={level} key={level.value}>
                <Box>
                  <Text fontWeight="medium">{level.name}</Text>
                  <Text fontSize="xs" color="gray.400">{level.description}</Text>
                </Box>
              </SelectItem>
            ))}
          </SelectContent>
        </SelectRoot>
      </Box>
    </DListItem>
  );
});

// ─── Main panel ───────────────────────────────────────────────────────────────

export const SecuritySettingsPanel = ({ dto, type }) => {
  const [players, setPlayers] = React.useState(null);        // null = loading
  const [savedPermissions, setSavedPermissions] = React.useState({});
  const [currentPlayerId, setCurrentPlayerId] = React.useState(null);

  const playersRef = React.useRef(players);
  playersRef.current = players;
  // ── initial load ────────────────────────────────────────────────────────

  React.useEffect(() => {
    const load = async () => {
      try {
        const [allPlayers, currentPlayer, permissions] = await Promise.all([
          ClientMediator.sendCommandWaitForRegisterAsync("Game", "GetPlayers", { uniqueKey: "security_GetPlayers" }, true),
          ClientMediator.sendCommandWaitForRegisterAsync("Game", "GetCurrentPlayer", { uniqueKey: "security_GetCurrentPlayer" }, true),
          WebHelper.getAsync(`security/permissions?entityId=${dto.id}&entityType=${type}`),
        ]);

        setCurrentPlayerId(currentPlayer?.id ?? null);
        setSavedPermissions(permissions ?? {});

        const withPerms = [
          ...allPlayers.map((p) => ({
            ...p,
            permission: permissions?.[p.id] ?? -1,
          })),
          {
            id: UtilityHelper.EmptyGuid,
            name: "Everyone (default)",
            permission: permissions?.[UtilityHelper.EmptyGuid] ?? -1,
          },
        ];

        setPlayers(withPerms);
      } catch (err) {
        console.error("SecuritySettingsPanel: failed to load permissions", err);
        setPlayers([]);   // exit loading state even on error
      }
    };

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dto.id]);

  // ── handlers ────────────────────────────────────────────────────────────

  const handlePermissionChange = React.useCallback((playerId, value) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, permission: value } : p))
    );
  }, []);
  const handleSave = () => {
    if (!players) return;

    const newPermissions = {};
    players.forEach((p) => { newPermissions[p.id] = parseInt(p.permission, 10); });

    const cmd = CommandFactory.CreateUpdatePermissionsCommand(dto.id, type, newPermissions);
    const sent = WebSocketManagerInstance.Send(cmd);

    // Optimistically mark as saved so isDirty clears immediately.
    // The WS echo in handleIncomingUpdate will confirm (or revert on error).
    if (sent) {
      setSavedPermissions(newPermissions);
    }
  };

  const handleReset = () => {
    setPlayers((prev) =>
      prev.map((p) => ({ ...p, permission: savedPermissions[p.id] ?? -1 }))
    );
  };

  // ── websocket ───────────────────────────────────────────────────────────
  const handleIncomingUpdate = (cmd) => {
    if (cmd.data?.id !== dto.id) return;

    const isOk = cmd.result === "Ok";
    const incoming = cmd.data.permissions ?? {};

    // Always sync local state to whatever the server confirmed.
    setSavedPermissions(incoming);
    setPlayers((prev) =>
      prev ? prev.map((p) => ({ ...p, permission: incoming[p.id] ?? -1 })) : prev
    );

    toaster.create({
      description: isOk ? "Permissions saved." : "Error saving permissions.",
      type: isOk ? "success" : "error",
      duration: 4000,
    });
  };

  // ── derived ─────────────────────────────────────────────────────────────

  const isDirty = React.useMemo(() => {
    if (!players) return false;
    return players.some((p) => (savedPermissions[p.id] ?? -1) !== p.permission);
  }, [players, savedPermissions]);

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <BasePanel>
      <Subscribable commandPrefix="permission_update" onMessage={handleIncomingUpdate} />      
      {players === null ? (
        <Flex flex="1" align="center" justify="center">
          <Text fontSize="sm" color="gray.400">Loading permissions…</Text>
        </Flex>
      ) : (
        <>
          <DList>
            {players.map((player) => (
              <PlayerPermissionRow
                key={player.id}
                player={player}
                isCurrentPlayer={player.id === currentPlayerId}
                onChange={handlePermissionChange}
              />
            ))}
          </DList>

          <Box borderTop="1px solid" borderColor="whiteAlpha.100" pt={2} px={2} pb={2}>
            {isDirty && (
              <Badge colorPalette="orange" variant="subtle" fontSize="xs" mb={2}>
                Unsaved changes
              </Badge>
            )}
            <HStack gap={2}>
              <Button size="sm" variant="outline" disabled={!isDirty} onClick={handleSave}>
                Save
              </Button>
              <Button size="sm" variant="ghost" disabled={!isDirty} onClick={handleReset}>
                Reset
              </Button>
            </HStack>
          </Box>
        </>
      )}
    </BasePanel>
  );
};

export default SecuritySettingsPanel;
