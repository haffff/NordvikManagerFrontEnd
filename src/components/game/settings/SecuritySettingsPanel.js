import * as React from "react";
import { Badge, Box, Button, Flex, HStack, Heading, IconButton, Stack, Text } from "@chakra-ui/react";
import { Checkbox } from "../../ui/checkbox";
import { FaSlidersH, FaList } from "react-icons/fa";
import CommandFactory from "../../BattleMap/Factories/CommandFactory";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import Subscribable from "../../uiComponents/base/Subscribable";
import { ActiveWebHelper as WebHelper } from "../../../helpers/transport";
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
import { PERM } from "../../BattleMap/Helpers/permissionBits";

// ─── Constants ────────────────────────────────────────────────────────────────

const PERMISSION_LEVELS = [
  { label: "Not set",  value: PERM.NOT_SET, description: "Permission has not been explicitly set — falls back to game defaults." },
  { label: "None",     value: 0,  description: "Player cannot see or interact with this element." },
  { label: "See",      value: 1,  description: "Player can see this element but cannot interact with it." },
  { label: "Execute",  value: 3,  description: "Player can see and execute actions on this element, but cannot edit or remove it." },
  { label: "Control",  value: 5,  description: "Player can control / execute actions on this element, but cannot edit or remove it." },
  { label: "Edit",     value: 15, description: "Player can edit this element but cannot remove it." },
  { label: "All",      value: 31, description: "Player has full control — see, control, edit, and remove." },
];

const ROLES_COLLECTION = createListCollection({
  items: PERMISSION_LEVELS,
  itemToValue: (item) => String(item.value),
});

const BIT_FLAGS = [
  { label: "See",     bit: PERM.SEE },
  { label: "Execute", bit: PERM.EXECUTE },
  { label: "Control", bit: PERM.CONTROL },
  { label: "Edit",    bit: PERM.EDIT },
  { label: "Remove",  bit: PERM.REMOVE },
];

const isPresetLevel = (value) =>
  PERMISSION_LEVELS.some((l) => l.value === value);

// ─── Player permission row ────────────────────────────────────────────────────

const PlayerPermissionRow = React.memo(({ player, isCurrentPlayer, onChange }) => {
  const bits = player.permission ?? -1;
  const isCustom = !isPresetLevel(bits);

  const [advanced, setAdvanced] = React.useState(isCustom);

  // Auto-switch to advanced if value doesn't match any preset
  React.useEffect(() => {
    if (isCustom) setAdvanced(true);
  }, [isCustom]);

  const valueAsString = String(bits);
  const matchedLevel = PERMISSION_LEVELS.find((l) => String(l.value) === valueAsString);
  const effectiveBits = bits < 0 ? 0 : bits;

  const toggleBit = (bit) => {
    onChange(player.id, effectiveBits ^ bit);
  };

  return (
    <DListItem padding="10px">
      <Heading size="xs" width="40%" flexShrink={0}>
        {player.name}
        {isCurrentPlayer && (
          <Text as="span" fontSize="xs" color="gray.400" ml={2}>(you)</Text>
        )}
      </Heading>

      <Box flex="1">
        <HStack align="flex-start" gap={2}>
          <Box flex="1">
            {advanced ? (
              /* ── Advanced: individual bit checkboxes ── */
              <HStack wrap="wrap" gap={3} pt={1}>
                {BIT_FLAGS.map(({ label, bit }) => (
                  <Checkbox
                    key={bit}
                    size="sm"
                    checked={Boolean(effectiveBits & bit)}
                    onCheckedChange={() => toggleBit(bit)}
                  >
                    {label}
                  </Checkbox>
                ))}
              </HStack>
            ) : (
              /* ── Simple: preset level dropdown ── */
              <SelectRoot
                collection={ROLES_COLLECTION}
                value={[isCustom ? "__custom__" : valueAsString]}
                onValueChange={(e) => onChange(player.id, parseInt(e.value[0], 10))}
                size="sm"
              >
                <SelectTrigger>
                  <SelectValueText placeholder="Select permission">
                    {() =>
                      matchedLevel
                        ? matchedLevel.label
                        : `Custom (${bits})`
                    }
                  </SelectValueText>
                </SelectTrigger>
                <SelectContent zIndex={9999}>
                  {PERMISSION_LEVELS.map((level) => (
                    <SelectItem item={level} key={level.value}>
                      <Box>
                        <Text fontWeight="medium">{level.label}</Text>
                        <Text fontSize="xs" color="gray.400">{level.description}</Text>
                      </Box>
                    </SelectItem>
                  ))}
                  {isCustom && (
                    <SelectItem
                      item={{ label: `Custom (${bits})`, value: "__custom__" }}
                      key="__custom__"
                      disabled
                    >
                      <Box>
                        <Text fontWeight="medium" color="gray.400">Custom ({bits})</Text>
                        <Text fontSize="xs" color="gray.500">Switch to Advanced mode to edit individual bits.</Text>
                      </Box>
                    </SelectItem>
                  )}
                </SelectContent>
              </SelectRoot>
            )}
          </Box>

          <IconButton
            size="xs"
            variant="ghost"
            color={advanced ? "blue.300" : "gray.500"}
            title={advanced ? "Switch to simple mode" : "Advanced: set individual bits"}
            onClick={() => setAdvanced((v) => !v)}
            aria-label="Toggle advanced permissions"
            mt={1}
          >
            {advanced ? <FaList /> : <FaSlidersH />}
          </IconButton>
        </HStack>
      </Box>
    </DListItem>
  );
});

// ─── Main panel ───────────────────────────────────────────────────────────────

export const SecuritySettingsPanel = ({ dto, type }) => {
  const [players, setPlayers] = React.useState(null);        // null = loading
  const [savedPermissions, setSavedPermissions] = React.useState({});
  const [currentPlayerId, setCurrentPlayerId] = React.useState(null);
  const [applyToChildren, setApplyToChildren] = React.useState(false);

  const isMap = type === "MapModel";

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
    if (isMap && applyToChildren) {
      cmd.data.applyToChildren = true;
    }
    const sent = WebSocketManagerInstance.Send(cmd);

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
            {isMap && (
              <Box mb={2}>
                <Checkbox
                  size="sm"
                  checked={applyToChildren}
                  onCheckedChange={(e) => setApplyToChildren(!!e.checked)}
                >
                  <Text fontSize="xs" color="gray.300">Apply to all elements on this map</Text>
                </Checkbox>
              </Box>
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
