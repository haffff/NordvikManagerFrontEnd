import * as React from "react";
import {  Badge,
  Box,
  Button,
  HStack,
  Icon,
  Input,
  Separator,
  Stack,
  Table,
  Tabs,
  Text,
} from "@chakra-ui/react";
import {
  FaCheck,
  FaKey,
  FaMailBulk,
  FaPlus,
  FaShieldAlt,
  FaTrash,
  FaUser,
  FaUserPlus,
} from "react-icons/fa";
import { MdCopyAll, MdLink } from "react-icons/md";
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

const copyToClipboard = (text) => {
  if (navigator.clipboard) navigator.clipboard.writeText(text);
  else prompt("Copy this:", text);
};

/** Normalise any page-envelope shape the API might return into what DDataTable expects. */
const normalisePage = (result, page) => ({
  data:  result?.data  ?? result?.items ?? [],
  page:  result?.page  ?? page,
  total: result?.total ?? result?.totalItems ?? 0,
  count: result?.count ?? result?.pageSize  ?? 20,
});

/**
 * Designed API endpoints (implement these on the server):
 *
 * GET    user/users?page=N              → { data, page, total, count }
 * GET    user/invites?page=N            → { data, page, total, count }
 * GET    user/GenerateInvite?hours=N    → { key, expires }
 * DELETE user/deleteuser?userID=...     → 200
 * DELETE user/deleteinvite?key=...      → 200
 * POST   user/createuser                → { userName, email, password, isAdmin } → 200 | 400 { message }
 * POST   user/resetpassword             → { userID, newPassword }               → 200 | 400 { message }
 * POST   user/toggleadmin               → { userID, isAdmin }                   → 200
 */

// ─── Reset-password dialog ────────────────────────────────────────────────────

const ResetPasswordDialog = ({ user, onClose }) => {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm]   = React.useState("");
  const [busy, setBusy]         = React.useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;
  const valid    = password.length >= 6 && password === confirm;

  const handleSubmit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const resp = await WebHelper.postAsync("user/resetpassword", {
        userID: user.id,
        newPassword: password,
      });
      if (resp.ok) {
        toaster.create({ description: `Password reset for "${user.userName}".`, type: "success", duration: 4000 });
        onClose();
      } else {
        const body = await resp.json().catch(() => ({}));
        toaster.create({ description: body?.message ?? "Failed to reset password.", type: "error", duration: 5000 });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogRoot open onOpenChange={(e) => { if (!e.open) onClose(); }} size="sm">
      <DialogBackdrop />
      <DialogContent>
        <DialogCloseTrigger />
        <DialogHeader>Reset password — {user.userName}</DialogHeader>
        <DialogBody>
          <Stack gap={3}>
            <Box>
              <Text fontSize="sm" mb={1}>New password <Text as="span" color="gray.400" fontSize="xs">(min. 6 characters)</Text></Text>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
              />
            </Box>
            <Box>
              <Text fontSize="sm" mb={1}>Confirm password</Text>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat new password"
                borderColor={mismatch ? "red.400" : undefined}
              />
              {mismatch && <Text fontSize="xs" color="red.400" mt={1}>Passwords do not match.</Text>}
            </Box>
          </Stack>
        </DialogBody>
        <DialogFooter>
          <HStack gap={2}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              variant="outline"
              colorPalette="orange"
              disabled={!valid}
              loading={busy}
              onClick={handleSubmit}
            >
              Reset password
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

// ─── Create-user form ─────────────────────────────────────────────────────────

const EMPTY_FORM = { userName: "", email: "", password: "", isAdmin: false };

const CreateUserForm = ({ onCreated }) => {
  const [open, setOpen]       = React.useState(false);
  const [form, setForm]       = React.useState(EMPTY_FORM);
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy]       = React.useState(false);
  const [errors, setErrors]   = React.useState([]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const mismatch = confirm.length > 0 && form.password !== confirm;
  const valid = form.userName.trim().length > 0
    && form.password.length >= 6
    && form.password === confirm;

  const handleSubmit = async () => {
    if (!valid) return;
    setBusy(true);
    setErrors([]);
    try {
      const resp = await WebHelper.postAsync("user/createuser", form);
      if (resp.ok) {
        toaster.create({ description: `User "${form.userName}" created.`, type: "success", duration: 4000 });
        setForm(EMPTY_FORM);
        setConfirm("");
        setOpen(false);
        onCreated();
      } else {
        const body = await resp.json().catch(() => ({}));
        const msg  = body?.message ?? body?.errors ?? "Failed to create user.";
        setErrors(Array.isArray(msg) ? msg : [msg]);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Icon as={FaUserPlus} mr={1} /> Create user
      </Button>

      <DialogRoot open={open} onOpenChange={(e) => setOpen(e.open)} size="sm">
        <DialogBackdrop />
        <DialogContent>
          <DialogCloseTrigger />
          <DialogHeader>Create user</DialogHeader>
          <DialogBody>
            <Stack gap={3}>
              {errors.length > 0 && (
                <Box p={3} borderRadius="md" bg="red.950" border="1px solid" borderColor="red.700">
                  {errors.map((e, i) => <Text key={i} fontSize="sm" color="red.300">{e}</Text>)}
                </Box>
              )}
              <Box>
                <Text fontSize="sm" mb={1}>Username <Text as="span" color="red.400">*</Text></Text>
                <Input value={form.userName} onChange={(e) => set("userName", e.target.value)} placeholder="username" />
              </Box>
              <Box>
                <Text fontSize="sm" mb={1}>Email</Text>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="user@example.com" />
              </Box>
              <Box>
                <Text fontSize="sm" mb={1}>Password <Text as="span" color="gray.400" fontSize="xs">(min. 6 characters)</Text></Text>
                <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Password" />
              </Box>
              <Box>
                <Text fontSize="sm" mb={1}>Confirm password</Text>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  borderColor={mismatch ? "red.400" : undefined}
                />
                {mismatch && <Text fontSize="xs" color="red.400" mt={1}>Passwords do not match.</Text>}
              </Box>
              <HStack gap={2} align="center">
                <Button
                  size="sm"
                  variant={form.isAdmin ? "solid" : "outline"}
                  colorPalette={form.isAdmin ? "orange" : "gray"}
                  onClick={() => set("isAdmin", !form.isAdmin)}
                >
                  <Icon as={FaShieldAlt} mr={1} />
                  {form.isAdmin ? "Admin" : "Regular user"}
                </Button>
                <Text fontSize="xs" color="gray.400">Click to toggle admin status</Text>
              </HStack>
            </Stack>
          </DialogBody>
          <DialogFooter>
            <HStack gap={2}>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="outline" disabled={!valid} loading={busy} onClick={handleSubmit}>
                <Icon as={FaCheck} mr={1} /> Create
              </Button>
            </HStack>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </>
  );
};

// ─── Users tab ────────────────────────────────────────────────────────────────

const UsersTab = React.memo(() => {
  const [info, setInfo]             = React.useState(null);
  const [resetTarget, setResetTarget] = React.useState(null);   // user to reset pw for
  const [togglingId, setTogglingId] = React.useState(null);

  const load = React.useCallback(async (page = 1) => {
    const result = await WebHelper.getAsync("user/users?page=" + page);
    setInfo(normalisePage(result, page));
  }, []);

  React.useEffect(() => { load(1); }, [load]);

  const handleDelete = async (userId, userName) => {
    if (!window.confirm(`Delete user "${userName}"? This cannot be undone.`)) return;
    try {
      // userID passed as query param — DELETE has no body
      await WebHelper.deleteAsync(`user/deleteuser?userID=${encodeURIComponent(userId)}`);
      toaster.create({ description: `User "${userName}" deleted.`, type: "success", duration: 4000 });
      load(info?.page ?? 1);
    } catch {
      toaster.create({ description: "Failed to delete user.", type: "error", duration: 4000 });
    }
  };

  const handleToggleAdmin = async (user) => {
    setTogglingId(user.id);
    try {
      const resp = await WebHelper.postAsync("user/toggleadmin", {
        userID: user.id,
        isAdmin: !user.isAdmin,
      });
      if (resp.ok) {
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
      {resetTarget && (
        <ResetPasswordDialog
          user={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}      {/* Toolbar */}
      <HStack mb={3} justify="flex-end">
        <CreateUserForm onCreated={() => load(1)} />
      </HStack>

      <DDataTable
        {...(info ?? EMPTY_PAGE)}
        GetData={load}
        GenerateHeader={() => (
          <>
            <Table.ColumnHeader>Username</Table.ColumnHeader>
            <Table.ColumnHeader>Email</Table.ColumnHeader>
            <Table.ColumnHeader width="70px">Role</Table.ColumnHeader>
            <Table.ColumnHeader width="120px" />
          </>
        )}
        GenerateRow={(user) => (
          <Table.Row key={user.id}>
            <Table.Cell fontWeight="medium">{user.userName}</Table.Cell>
            <Table.Cell color="gray.400" fontSize="sm">{user.email}</Table.Cell>
            <Table.Cell>
              {user.isAdmin
                ? <Badge colorPalette="orange" size="sm"><Icon as={FaShieldAlt} mr={1} />Admin</Badge>
                : <Badge variant="outline" size="sm">User</Badge>
              }
            </Table.Cell>
            <Table.Cell>
              <HStack gap={1} justify="flex-end">                {/* Toggle admin */}
                <Button
                  size="xs"
                  variant="ghost"
                  colorPalette={user.isAdmin ? "orange" : "gray"}
                  title={user.isAdmin ? "Remove admin" : "Make admin"}
                  loading={togglingId === user.id}
                  onClick={() => handleToggleAdmin(user)}
                >
                  <Icon as={FaShieldAlt} />
                </Button>
                {/* Reset password */}
                <Button
                  size="xs"
                  variant="ghost"
                  colorPalette="yellow"
                  title="Reset password"
                  onClick={() => setResetTarget(user)}
                >
                  <Icon as={FaKey} />
                </Button>                {/* Delete */}
                <Button
                  size="xs"
                  variant="ghost"
                  colorPalette="red"
                  title="Delete user"
                  onClick={() => handleDelete(user.id, user.userName)}
                >
                  <Icon as={FaTrash} />
                </Button>
              </HStack>
            </Table.Cell>
          </Table.Row>
        )}
        fallback={
          <Table.Row>
            <Table.Cell colSpan={4}>
              <Text textAlign="center" color="gray.400" py={4} fontSize="sm">
                {info === null ? "Loading…" : "No users found."}
              </Text>
            </Table.Cell>
          </Table.Row>
        }
      />
    </>
  );
});

// ─── Invites tab ──────────────────────────────────────────────────────────────

const InvitesTab = React.memo(() => {
  const [info, setInfo]         = React.useState(null);
  const [hours, setHours]       = React.useState(24);
  const [generating, setGenerating] = React.useState(false);

  const load = React.useCallback(async (page = 1) => {
    const result = await WebHelper.getAsync("user/invites?page=" + page);
    setInfo(normalisePage(result, page));
  }, []);

  React.useEffect(() => { load(1); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await WebHelper.getAsync("user/GenerateInvite?hours=" + hours);
      if (result) {
        toaster.create({ description: `Invite generated (valid for ${hours}h).`, type: "success", duration: 4000 });
        load(info?.page ?? 1);
      } else {
        toaster.create({ description: "Failed to generate invite.", type: "error", duration: 4000 });
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (key) => {
    if (!window.confirm("Delete this invite?")) return;
    try {
      await WebHelper.deleteAsync("user/deleteinvite?key=" + encodeURIComponent(key));
      toaster.create({ description: "Invite deleted.", type: "success", duration: 4000 });
      load(info?.page ?? 1);
    } catch {
      toaster.create({ description: "Failed to delete invite.", type: "error", duration: 4000 });
    }
  };

  const handleCopyCode = (invite) => {
    copyToClipboard(invite.key);
    toaster.create({ description: "Code copied.", type: "info", duration: 2000 });
  };

  const handleCopyUrl = (invite) => {
    const url = `${window.location.origin}${window.location.pathname}?code=${invite.key}`;
    copyToClipboard(url);
    toaster.create({ description: "Invite URL copied.", type: "info", duration: 2000 });
  };

  return (
    <Stack gap={3}>
      {/* Generate bar */}      <HStack
        gap={2} p={3} borderRadius="md"
        bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100"
      >
        <Text fontSize="sm" flexShrink={0}>Valid for</Text>
        <Input
          size="sm" type="number" min={1} max={8760}
          value={hours}
          onChange={(e) => setHours(Math.max(1, Number(e.target.value)))}
          width="80px"
        />
        <Text fontSize="sm" flexShrink={0}>hours</Text>
        <Button size="sm" variant="outline" loading={generating} onClick={handleGenerate}>
          <Icon as={FaPlus} mr={1} /> Generate invite
        </Button>
      </HStack>

      <Separator />

      <DDataTable
        {...(info ?? EMPTY_PAGE)}
        GetData={load}        GenerateHeader={() => (
          <>
            <Table.ColumnHeader>Code</Table.ColumnHeader>
            <Table.ColumnHeader>Expires</Table.ColumnHeader>
            <Table.ColumnHeader width="120px" />
          </>
        )}
        GenerateRow={(invite) => {
          const expires   = new Date(invite.value);
          const isExpired = expires < new Date();
          const formatted = expires.toLocaleDateString() + " " + expires.toLocaleTimeString();
          const codeShort = invite.key.substring(0, 10) + "…";

          return (            <Table.Row key={invite.key} opacity={isExpired ? 0.45 : 1}>
              <Table.Cell fontFamily="mono" fontSize="xs">
                <HStack gap={2}>
                  <Text>{codeShort}</Text>
                  {isExpired && <Badge colorPalette="red" size="sm">expired</Badge>}
                </HStack>
              </Table.Cell>
              <Table.Cell fontSize="sm" color="gray.400">{formatted}</Table.Cell>
              <Table.Cell>
                <HStack gap={1} justify="flex-end">
                  <Button size="xs" variant="ghost" title="Copy code" onClick={() => handleCopyCode(invite)}>
                    <Icon as={MdCopyAll} />
                  </Button>
                  <Button size="xs" variant="ghost" title="Copy invite URL" onClick={() => handleCopyUrl(invite)}>
                    <Icon as={MdLink} />
                  </Button>
                  <Button size="xs" variant="ghost" colorPalette="red" title="Delete" onClick={() => handleDelete(invite.key)}>
                    <Icon as={FaTrash} />
                  </Button>
                </HStack>
              </Table.Cell>
            </Table.Row>
          );
        }}
        fallback={
          <Table.Row>
            <Table.Cell colSpan={3}>
              <Text textAlign="center" color="gray.400" py={4} fontSize="sm">
                {info === null ? "Loading…" : "No active invites. Generate one above."}
              </Text>
            </Table.Cell>
          </Table.Row>
        }
      />
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
        <DialogHeader>User Management</DialogHeader>
        <DialogBody>
          <Tabs.Root defaultValue="users" lazyMount>
            <Tabs.List mb={4}>
              <Tabs.Trigger value="users">
                <Icon as={FaUser} mr={2} /> Users
              </Tabs.Trigger>
              <Tabs.Trigger value="invites">
                <Icon as={FaMailBulk} mr={2} /> Invites
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="users">
              <UsersTab />
            </Tabs.Content>
            <Tabs.Content value="invites">
              <InvitesTab />
            </Tabs.Content>
          </Tabs.Root>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

export default UserManagementDialog;
