import * as React from "react";
import {
  Accordion,
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Separator,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import {
  FaBan,
  FaChevronDown,
  FaExternalLinkAlt,
  FaLockOpen,
  FaTrash,
  FaUser,
  FaUserSlash,
} from "react-icons/fa";
import WebHelper from "../../helpers/WebHelper";
import CentralWebHelper from "../../helpers/CentralWebHelper";
import { toaster } from "../ui/toaster";
import {
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
} from "../ui/dialog";
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPageText,
  PaginationPrevTrigger,
  PaginationRoot,
} from "../ui/pagination";

// ─── Central profile cache ────────────────────────────────────────────────────
// Module-level so cache survives re-renders within a session.

const _profileCache = {};

async function fetchCentralProfile(centralUserId) {
  if (_profileCache[centralUserId] !== undefined) return _profileCache[centralUserId];
  const data = await CentralWebHelper.getAsync(
    `user/profile?userId=${encodeURIComponent(centralUserId)}`
  );
  _profileCache[centralUserId] = data ?? null;
  return _profileCache[centralUserId];
}

// ─── PlayerRow ────────────────────────────────────────────────────────────────

const PlayerRow = React.memo(({ player, onKick }) => (
  <HStack
    justify="space-between"
    py="4px"
    px="8px"
    borderRadius="sm"
    _hover={{ bg: "whiteAlpha.50" }}
  >
    <HStack gap={2}>
      <Box
        w="10px"
        h="10px"
        borderRadius="full"
        flexShrink={0}
        style={{ backgroundColor: player.color }}
      />
      <Text fontSize="sm">{player.name}</Text>
    </HStack>
    <Button
      size="xs"
      variant="ghost"
      colorPalette="yellow"
      title="Kick this character from the game"
      onClick={() => onKick(player)}
    >
      <Icon as={FaUserSlash} />
    </Button>
  </HStack>
));

// ─── UserAccordionItem ────────────────────────────────────────────────────────

const UserAccordionItem = React.memo(({ centralUserId, players, isBanned, onKick, onRemove, onBan, onUnban }) => {
  const [profile, setProfile] = React.useState(undefined); // undefined = loading, null = failed

  React.useEffect(() => {
    let alive = true;
    fetchCentralProfile(centralUserId).then((p) => { if (alive) setProfile(p); });
    return () => { alive = false; };
  }, [centralUserId]);

  const username =
    profile?.username ??
    profile?.userName ??
    profile?.name ??
    (profile === null ? centralUserId.slice(0, 8) + "…" : null);

  const centralRoot = CentralWebHelper.BaseUrl.replace(/\/api$/, "");
  const profileUrl  = centralRoot
    ? `${centralRoot}/profile?userId=${encodeURIComponent(centralUserId)}`
    : null;

  const charLabel = `${players.length} character${players.length !== 1 ? "s" : ""}`;

  return (
    <Accordion.Item value={centralUserId}>
      <Accordion.ItemTrigger>
        <Flex flex={1} align="center" gap={2} minW={0}>
          <Icon as={FaUser} color="gray.500" flexShrink={0} boxSize="12px" />
          <Text
            fontWeight="medium"
            flex={1}
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
            fontSize="sm"
          >
            {username === null ? <Spinner size="xs" /> : username}
          </Text>
          <HStack gap={1} mr={1} flexShrink={0}>
            <Badge size="sm" colorPalette="gray">{charLabel}</Badge>
            {isBanned && <Badge size="sm" colorPalette="red">Banned</Badge>}
          </HStack>
        </Flex>

        {/* Action buttons — stop propagation so they don't toggle the accordion */}
        <HStack gap={1} onClick={(e) => e.stopPropagation()} flexShrink={0}>
          {profileUrl && (
            <Button
              size="xs"
              variant="ghost"
              colorPalette="blue"
              title="View profile on central server"
              onClick={(e) => {
                e.stopPropagation();
                window.open(profileUrl, "_blank", "noopener,noreferrer");
              }}
            >
              <Icon as={FaExternalLinkAlt} />
            </Button>
          )}
          <Button
            size="xs"
            variant="ghost"
            colorPalette="red"
            title="Remove user and all their characters from this server"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(centralUserId, username);
            }}
          >
            <Icon as={FaTrash} />
          </Button>
          {isBanned ? (
            <Button
              size="xs"
              variant="ghost"
              colorPalette="green"
              title="Unban user"
              onClick={(e) => {
                e.stopPropagation();
                onUnban(centralUserId, username);
              }}
            >
              <Icon as={FaLockOpen} />
            </Button>
          ) : (
            <Button
              size="xs"
              variant="ghost"
              colorPalette="red"
              title="Ban user from this server"
              onClick={(e) => {
                e.stopPropagation();
                onBan(centralUserId, username);
              }}
            >
              <Icon as={FaBan} />
            </Button>
          )}
        </HStack>

        <Accordion.ItemIndicator>
          <Icon as={FaChevronDown} boxSize="10px" />
        </Accordion.ItemIndicator>
      </Accordion.ItemTrigger>

      <Accordion.ItemContent>
        <Box pb={2} pt={1}>
          {players.map((p) => (
            <PlayerRow key={p.id} player={p} onKick={onKick} />
          ))}
        </Box>
      </Accordion.ItemContent>
    </Accordion.Item>
  );
});

// ─── PlayersTab ───────────────────────────────────────────────────────────────

const PlayersTab = React.memo(() => {
  const [pageData, setPageData] = React.useState(null);
  const [loading,  setLoading]  = React.useState(false);

  const load = React.useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const result = await WebHelper.getAsync(`user/getplayers?page=${page}`);
      setPageData(result ?? { page: 1, count: 10, total: 0, data: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(1); }, [load]);

  // Group players by centralServerUserId (preserving first-seen order).
  // isBanned is taken from the first player in the group — all players for a
  // banned account share the same ban state.
  const groups = React.useMemo(() => {
    if (!pageData?.data?.length) return [];
    const map = new Map();
    for (const player of pageData.data) {
      const uid = player.centralServerUserId;
      if (!map.has(uid)) map.set(uid, []);
      map.get(uid).push(player);
    }
    return [...map.entries()].map(([id, players]) => ({
      id,
      players,
      isBanned: Boolean(players[0]?.banned),
    }));
  }, [pageData]);

  const handleKick = async (player) => {
    if (!window.confirm(`Kick "${player.name}" from the game?`)) return;
    try {
      await WebHelper.postAsync("user/kickplayer", { playerId: player.id });
      toaster.create({ description: `"${player.name}" kicked.`, type: "success", duration: 4000 });
      load(pageData?.page ?? 1);
    } catch {
      toaster.create({ description: "Failed to kick player.", type: "error", duration: 4000 });
    }
  };

  const handleRemove = async (centralUserId, username) => {
    const label = username ?? "this user";
    if (!window.confirm(`Remove "${label}" entirely from this server? All their characters will be deleted.`)) return;
    try {
      await WebHelper.postAsync("user/removeuser", { centralUserId });
      toaster.create({ description: `"${label}" removed from server.`, type: "success", duration: 4000 });
      load(1);
    } catch {
      toaster.create({ description: "Failed to remove user.", type: "error", duration: 4000 });
    }
  };

  const handleBan = async (centralUserId, username) => {
    const label = username ?? "this user";
    if (!window.confirm(`Ban "${label}" from this server?`)) return;
    try {
      await WebHelper.postAsync("user/banuser", { centralUserId });
      toaster.create({ description: `"${label}" banned.`, type: "success", duration: 4000 });
      load(pageData?.page ?? 1);
    } catch {
      toaster.create({ description: "Failed to ban user.", type: "error", duration: 4000 });
    }
  };

  const handleUnban = async (centralUserId, username) => {
    const label = username ?? "this user";
    if (!window.confirm(`Unban "${label}"?`)) return;
    try {
      await WebHelper.postAsync("user/unban", { centralUserId });
      toaster.create({ description: `"${label}" unbanned.`, type: "success", duration: 4000 });
      load(pageData?.page ?? 1);
    } catch {
      toaster.create({ description: "Failed to unban user.", type: "error", duration: 4000 });
    }
  };

  if (loading && !pageData) {
    return (
      <Flex align="center" justify="center" py={12} gap={3} color="gray.500">
        <Spinner size="sm" />
        <Text fontSize="sm">Loading players…</Text>
      </Flex>
    );
  }

  return (
    <Stack gap={4}>
      <Box p={3} borderRadius="md" bg="blue.950" border="1px solid" borderColor="blue.800">
        <Text fontSize="sm" color="blue.300">
          Players are grouped by their central server account. Expand a row to see all characters
          for that user and kick individual ones, or use the action buttons to remove/ban the
          account entirely.
        </Text>
      </Box>

      {groups.length === 0 ? (
        <Text textAlign="center" color="gray.400" py={8} fontSize="sm">
          {loading ? "Loading…" : "No players found."}
        </Text>
      ) : (
        <Accordion.Root collapsible multiple variant="enclosed">
          {groups.map((g) => (
            <UserAccordionItem
              key={g.id}
              centralUserId={g.id}
              players={g.players}
              isBanned={g.isBanned}
              onKick={handleKick}
              onRemove={handleRemove}
              onBan={handleBan}
              onUnban={handleUnban}
            />
          ))}
        </Accordion.Root>
      )}

      {pageData && pageData.total > pageData.count && (
        <PaginationRoot
          key={pageData.page}
          count={pageData.total}
          pageSize={pageData.count}
          page={pageData.page}
          onPageChange={(e) => load(e.page)}
          defaultPage={1}
        >
          <HStack>
            <PaginationPrevTrigger />
            <PaginationItems />
            <PaginationNextTrigger />
          </HStack>
          <PaginationPageText margin="10px" format="long" />
        </PaginationRoot>
      )}
    </Stack>
  );
});

// ─── Dialog shell ─────────────────────────────────────────────────────────────

export const UserManagementDialog = ({ openRef }) => {
  const [open, setOpen] = React.useState(false);

  openRef.current = () => setOpen(true);

  return (
    <DialogRoot size="cover" open={open} onOpenChange={(e) => setOpen(e.open)}>
      <DialogBackdrop />
      <DialogContent>
        <DialogCloseTrigger />
        <DialogHeader>
          <HStack gap={2}>
            <Icon as={FaUser} />
            <Text>Player Management</Text>
          </HStack>
        </DialogHeader>
        <DialogBody>
          <Separator mb={4} />
          <PlayersTab />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

export default UserManagementDialog;
