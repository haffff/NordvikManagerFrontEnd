import * as React from "react";
import {
  Badge,
  Box,
  Button,
  HStack,
  Icon,
  Separator,
  Stack,
  Table,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import {
  FaBan,
  FaShieldAlt,
  FaTrash,
  FaUser,
  FaUserSlash,
} from "react-icons/fa";
import WebHelper from "../../helpers/WebHelper";
import { toaster } from "../ui/toaster";
import { DDataTable } from "../uiComponents/DDataTable";
import {
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
} from "../ui/dialog";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_PAGE = { data: [], page: 1, total: 0, count: 20 };

const normalisePage = (result, page) => ({
  data:  result?.data  ?? result?.items ?? [],
  page:  result?.page  ?? page,
  total: result?.total ?? result?.totalItems ?? 0,
  count: result?.count ?? result?.pageSize  ?? 20,
});

// ─── Users tab ────────────────────────────────────────────────────────────────

const UsersTab = React.memo(() => {
  const [info, setInfo]             = React.useState(null);
  const [togglingId, setTogglingId] = React.useState(null);

  const load = React.useCallback(async (page = 1) => {
    const result = await WebHelper.getAsync("user/users?page=" + page);
    setInfo(normalisePage(result, page));
  }, []);

  React.useEffect(() => { load(1); }, [load]);

  const handleDelete = async (userId, userName) => {
    if (!window.confirm(`Remove "${userName}" from this server? This cannot be undone.`)) return;
    try {
      await WebHelper.deleteAsync(`user/deleteuser?userID=${encodeURIComponent(userId)}`);
      toaster.create({ description: `"${userName}" removed.`, type: "success", duration: 4000 });
      load(info?.page ?? 1);
    } catch {
      toaster.create({ description: "Failed to remove user.", type: "error", duration: 4000 });
    }
  };

  const handleToggleAdmin = async (user) => {
    setTogglingId(user.id);
    try {
      const resp = await WebHelper.postAsync("user/toggleadmin", {
        userID: user.id,
        isAdmin: !user.isAdmin,
      });
      if (resp?.ok) {
        toaster.create({
          description: `${user.userName} is now ${!user.isAdmin ? "an admin" : "a regular user"}.`,
          type: "success",
          duration: 4000,
        });
        load(info?.page ?? 1);
      } else {
        toaster.create({ description: "Failed to update admin status.", type: "error", duration: 4000 });
      }
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <>
      <Box mb={3} p={3} borderRadius="md" bg="blue.950" border="1px solid" borderColor="blue.800">
        <Text fontSize="sm" color="blue.300">
          User accounts are managed through the central server. Use this panel to manage
          player access and roles within your local game server.
        </Text>
      </Box>

      <DDataTable
        {...(info ?? EMPTY_PAGE)}
        GetData={load}
        GenerateHeader={() => (
          <>
            <Table.ColumnHeader>Username</Table.ColumnHeader>
            <Table.ColumnHeader>Email</Table.ColumnHeader>
            <Table.ColumnHeader width="70px">Role</Table.ColumnHeader>
            <Table.ColumnHeader width="140px" />
          </>
        )}
        GenerateRow={(user) => (
          <Table.Row key={user.id}>
            <Table.Cell fontWeight="medium">{user.userName}</Table.Cell>
            <Table.Cell color="gray.400" fontSize="sm">{user.email ?? "—"}</Table.Cell>
            <Table.Cell>
              {user.isAdmin
                ? <Badge colorPalette="orange" size="sm"><Icon as={FaShieldAlt} mr={1} />Admin</Badge>
                : <Badge variant="outline" size="sm">Player</Badge>
              }
            </Table.Cell>
            <Table.Cell>
              <HStack gap={1} justify="flex-end">
                {/* Toggle admin */}
                <Tooltip content={user.isAdmin ? "Remove admin" : "Make admin"}>
                  <Button
                    size="xs"
                    variant="ghost"
                    colorPalette={user.isAdmin ? "orange" : "gray"}
                    loading={togglingId === user.id}
                    onClick={() => handleToggleAdmin(user)}
                  >
                    <Icon as={FaShieldAlt} />
                  </Button>
                </Tooltip>

                {/* Kick — placeholder */}
                <Tooltip content="Kick player (not yet implemented)">
                  <Button size="xs" variant="ghost" colorPalette="yellow" disabled>
                    <Icon as={FaUserSlash} />
                  </Button>
                </Tooltip>

                {/* Ban — placeholder */}
                <Tooltip content="Ban player (not yet implemented)">
                  <Button size="xs" variant="ghost" colorPalette="red" disabled>
                    <Icon as={FaBan} />
                  </Button>
                </Tooltip>

                {/* Remove from server */}
                <Tooltip content="Remove from server">
                  <Button
                    size="xs"
                    variant="ghost"
                    colorPalette="red"
                    onClick={() => handleDelete(user.id, user.userName)}
                  >
                    <Icon as={FaTrash} />
                  </Button>
                </Tooltip>
              </HStack>
            </Table.Cell>
          </Table.Row>
        )}
        fallback={
          <Table.Row>
            <Table.Cell colSpan={4}>
              <Text textAlign="center" color="gray.400" py={4} fontSize="sm">
                {info === null ? "Loading…" : "No players found."}
              </Text>
            </Table.Cell>
          </Table.Row>
        }
      />
    </>
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
          <UsersTab />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

export default UserManagementDialog;
