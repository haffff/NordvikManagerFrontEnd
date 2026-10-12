import * as React from "react";
import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  Icon,
  IconButton,
  Input,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { FaDownload, FaFileUpload, FaHistory, FaSave, FaTrash, FaUndo } from "react-icons/fa";

import WebHelper from "../../../helpers/WebHelper";
import { toaster } from "../../ui/toaster";
import { Field } from "../../ui/field";
import { Switch } from "../../ui/switch";
import { NumberInputField, NumberInputRoot } from "../../ui/number-input";

const KIND_LABELS = {
  Manual: "Manual",
  Scheduled: "Scheduled",
  PreRestore: "Before restore",
  Imported: "Uploaded",
};

const formatSize = (bytes) => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const formatDate = (utc) => (utc ? new Date(utc).toLocaleString() : "—");

// The backend answers errors as { error: "..." }; fall back to the status code.
const errorMessage = async (response) => {
  if (!response) return "The server could not be reached.";
  try {
    const body = await response.json();
    if (body?.error) return body.error;
  } catch (e) {
    // not JSON
  }
  return `Request failed (HTTP ${response.status}).`;
};

const showError = async (title, response) =>
  toaster.create({ title, description: await errorMessage(response), type: "error" });

/**
 * Application Settings → Backups. Whole-server backups (database + uploaded resource files):
 * make one now, download/delete/restore existing ones, upload one from another machine, and
 * set up a schedule. A restore is applied the next time the server starts.
 */
export const BackupSettingsTab = () => {
  const [status, setStatus] = React.useState(undefined);
  const [schedule, setSchedule] = React.useState(undefined);
  const [label, setLabel] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  // { name, action: "restore" | "delete" } — the row waiting for its confirm click.
  const [confirming, setConfirming] = React.useState(null);
  const fileInputRef = React.useRef(null);

  const load = React.useCallback(async () => {
    const [statusResult, scheduleResult] = await Promise.all([
      WebHelper.getAsync("backup"),
      WebHelper.getAsync("backup/schedule"),
    ]);
    setStatus(statusResult ?? null);
    if (scheduleResult) setSchedule(scheduleResult);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const run = async (work) => {
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const createBackup = () =>
    run(async () => {
      const response = await WebHelper.postAsync("backup", { label });
      if (!response?.ok) return showError("Backup failed", response);
      setLabel("");
      toaster.create({ title: "Backup created", type: "success" });
      await load();
    });

  const stageRestore = (name) =>
    run(async () => {
      const response = await WebHelper.postAsync(`backup/${name}/restore`, {});
      if (!response?.ok) return showError("Restore failed", response);
      toaster.create({
        title: "Restore ready",
        description: "Restart the server to finish restoring the backup.",
        type: "success",
        duration: 10000,
      });
      await load();
    });

  const uploadRestore = (file) =>
    run(async () => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await WebHelper.postAsync("backup/restore/upload", formData, true);
      if (!response?.ok) return showError("Upload failed", response);
      toaster.create({
        title: "Restore ready",
        description: "Restart the server to finish restoring the uploaded backup.",
        type: "success",
        duration: 10000,
      });
      await load();
    });

  const deleteBackup = (name) =>
    run(async () => {
      const result = await WebHelper.deleteAsync(`backup/${name}`);
      if (result === undefined) toaster.create({ title: "Could not delete the backup", type: "error" });
      await load();
    });

  const cancelRestore = () =>
    run(async () => {
      const result = await WebHelper.deleteAsync("backup/restore/pending");
      if (result === undefined) toaster.create({ title: "Could not cancel the restore", type: "error" });
      await load();
    });

  const saveSchedule = () =>
    run(async () => {
      const response = await WebHelper.putAsync("backup/schedule", {
        enabled: schedule.enabled,
        intervalHours: schedule.intervalHours,
        retentionCount: schedule.retentionCount,
      });
      if (!response?.ok) return showError("Could not save the schedule", response);
      setSchedule(await response.json());
      toaster.create({ title: "Schedule saved", type: "success" });
    });

  // First click arms the button, the second one runs the action.
  const confirmThen = (name, action, perform) => () => {
    if (confirming?.name === name && confirming?.action === action) perform(name);
    else setConfirming({ name, action });
  };
  const isConfirming = (name, action) => confirming?.name === name && confirming?.action === action;

  if (status === undefined) return <Text>Loading backups…</Text>;
  if (status === null) return <Text color="red.300">Could not load backups from the server.</Text>;
  if (!status.supported)
    return (
      <Text>
        Backups are only available with the SQLite database. This server uses a different database —
        back it up with that database's own tools.
      </Text>
    );

  return (
    <Stack gap={6} maxW="5xl">
      {status.pendingRestore && (
        <Box borderWidth="1px" borderColor="orange.400" borderRadius="md" p={3}>
          <HStack justify="space-between" wrap="wrap">
            <Text>
              <b>{status.pendingRestore.backupName}</b> will be restored when the server restarts.
              Everything changed until then will be replaced.
            </Text>
            <Button size="sm" variant="outline" onClick={cancelRestore} disabled={busy}>
              Cancel restore
            </Button>
          </HStack>
        </Box>
      )}
      {status.failedRestore && !status.pendingRestore && (
        <Box borderWidth="1px" borderColor="red.400" borderRadius="md" p={3}>
          <Text>
            <b>{status.failedRestore.backupName}</b> could not be restored at the last server start; the
            existing data was kept. See the server log for details.
          </Text>
        </Box>
      )}

      <Stack gap={3}>
        <Heading size="md">Back up</Heading>
        <Text fontSize="sm" color="fg.muted">
          A backup holds the database and the resource files uploaded to this server. Files linked from
          elsewhere on the disk are not included.
        </Text>
        <HStack>
          <Input
            maxW="sm"
            placeholder="Optional label, e.g. before session 12"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button onClick={createBackup} loading={busy}>
            <Icon as={FaSave} />
            Back up now
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={busy}>
            <Icon as={FaFileUpload} />
            Restore from file…
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            style={{ display: "none" }}
            data-testid="backup-upload-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) uploadRestore(file);
            }}
          />
        </HStack>
      </Stack>

      <Stack gap={3}>
        <Heading size="md">Backups on this server</Heading>
        {status.backups.length === 0 ? (
          <Text color="fg.muted">No backups yet.</Text>
        ) : (
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Created</Table.ColumnHeader>
                <Table.ColumnHeader>Type</Table.ColumnHeader>
                <Table.ColumnHeader>File</Table.ColumnHeader>
                <Table.ColumnHeader>Size</Table.ColumnHeader>
                <Table.ColumnHeader />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {status.backups.map((backup) => (
                <Table.Row key={backup.name}>
                  <Table.Cell>{formatDate(backup.createdAtUtc)}</Table.Cell>
                  <Table.Cell>
                    <Badge>{KIND_LABELS[backup.kind] ?? backup.kind}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text fontSize="xs" wordBreak="break-all">{backup.name}</Text>
                  </Table.Cell>
                  <Table.Cell whiteSpace="nowrap">{formatSize(backup.sizeBytes)}</Table.Cell>
                  <Table.Cell>
                    <HStack justify="flex-end" gap={1}>
                      <IconButton
                        size="xs"
                        variant="ghost"
                        aria-label={`Download ${backup.name}`}
                        title="Download"
                        onClick={() => WebHelper.downloadFileAsync(`backup/${backup.name}/download`, backup.name)}
                      >
                        <FaDownload />
                      </IconButton>
                      <Button
                        size="xs"
                        colorPalette="orange"
                        variant={isConfirming(backup.name, "restore") ? "solid" : "outline"}
                        aria-label={`${isConfirming(backup.name, "restore") ? "Confirm restore" : "Restore"} ${backup.name}`}
                        disabled={busy}
                        onClick={confirmThen(backup.name, "restore", stageRestore)}
                      >
                        <FaUndo />
                        {isConfirming(backup.name, "restore") ? "Confirm restore" : "Restore"}
                      </Button>
                      <Button
                        size="xs"
                        colorPalette="red"
                        variant={isConfirming(backup.name, "delete") ? "solid" : "ghost"}
                        aria-label={`${isConfirming(backup.name, "delete") ? "Confirm delete" : "Delete"} ${backup.name}`}
                        disabled={busy}
                        onClick={confirmThen(backup.name, "delete", deleteBackup)}
                      >
                        <FaTrash />
                        {isConfirming(backup.name, "delete") && "Confirm delete"}
                      </Button>
                    </HStack>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
        {confirming?.action === "restore" && (
          <Text fontSize="sm" color="orange.300">
            Restoring replaces all games and resource files with the backup's when the server next starts.
            A backup of the current data is made first.
          </Text>
        )}
      </Stack>

      {schedule && (
        <Stack gap={3}>
          <Heading size="md">
            <Icon as={FaHistory} mr={2} />
            Schedule
          </Heading>
          <Switch
            checked={schedule.enabled}
            onCheckedChange={(e) => setSchedule({ ...schedule, enabled: e.checked })}
          >
            Scheduled backups
          </Switch>
          <HStack align="flex-end" gap={4}>
            <Field label="Every (hours)" maxW="40">
              <NumberInputRoot
                min={1}
                max={8760}
                value={String(schedule.intervalHours)}
                onValueChange={(e) => setSchedule({ ...schedule, intervalHours: e.valueAsNumber || 1 })}
              >
                <NumberInputField />
              </NumberInputRoot>
            </Field>
            <Field label="Keep last" maxW="40">
              <NumberInputRoot
                min={1}
                max={1000}
                value={String(schedule.retentionCount)}
                onValueChange={(e) => setSchedule({ ...schedule, retentionCount: e.valueAsNumber || 1 })}
              >
                <NumberInputField />
              </NumberInputRoot>
            </Field>
            <Button onClick={saveSchedule} disabled={busy}>
              Save schedule
            </Button>
          </HStack>
          <Text fontSize="sm" color="fg.muted">
            Last scheduled backup: {formatDate(schedule.lastRunUtc)}
            {schedule.enabled && schedule.nextRunUtc && <> · next: {formatDate(schedule.nextRunUtc)}</>}
            . Only scheduled backups are cleaned up; manual ones stay until you delete them.
          </Text>
        </Stack>
      )}
    </Stack>
  );
};

export default BackupSettingsTab;
