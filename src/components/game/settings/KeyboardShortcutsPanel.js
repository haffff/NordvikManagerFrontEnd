import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import {
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Input,
  Separator,
  Stack,
  Text,
} from "@chakra-ui/react";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import { KeyComboRecorder } from "../../uiComponents/base/KeyComboRecorder";
import {
  DefaultShortCuts,
  KEY_COMBO_REGEX,
  fetchSavedBindings,
  saveBindings,
  mergeShortcuts,
  isValidBindingValue,
} from "../KeyBoardEventsManager";
import { toaster } from "../../ui/toaster";

const actionIdFor = (panel, command) => `${panel}.${command}`;
const panelLabel = (panel) => (panel === "battlemap" ? "Battle Map" : panel === "game" ? "Game" : panel);

// Builds one row per default action, plus one row per still-bound custom
// (server-only) action that isn't part of DefaultShortCuts.
function buildRows(effectiveShortCuts) {
  const rows = {};

  for (const [defaultKey, entry] of Object.entries(DefaultShortCuts)) {
    const id = actionIdFor(entry.panel, entry.command);
    rows[id] = {
      actionId: id,
      panel: entry.panel,
      command: entry.command,
      label: entry.label ?? id,
      defaultKey,
      currentKey: undefined,
    };
  }

  for (const [key, entry] of Object.entries(effectiveShortCuts)) {
    const id = actionIdFor(entry.panel, entry.command);
    if (!rows[id]) {
      rows[id] = {
        actionId: id,
        panel: entry.panel,
        command: entry.command,
        label: id,
        defaultKey: undefined,
        currentKey: key,
      };
    } else {
      rows[id].currentKey = key;
    }
  }

  return rows;
}

export const KeyboardShortcutsPanel = () => {
  const ctx = Dockable.useContentContext();
  ctx.setTitle("Keyboard Shortcuts");
  ctx.setPreferredSize(560, 640);

  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState({});
  const [edits, setEdits] = React.useState({}); // actionId -> desired key ("" = unbound)
  const [pickerCommand, setPickerCommand] = React.useState("");
  const [pickerKey, setPickerKey] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const loadRows = React.useCallback(async () => {
    const bindings = await fetchSavedBindings();
    setRows(buildRows(mergeShortcuts(bindings)));
  }, []);

  React.useEffect(() => {
    loadRows().finally(() => setLoading(false));
  }, [loadRows]);

  const effectiveKey = (row) => {
    if (edits[row.actionId] !== undefined) return edits[row.actionId];
    return row.currentKey ?? row.defaultKey;
  };

  const setKey = (actionId, key) => setEdits((prev) => ({ ...prev, [actionId]: key }));

  // Always writes an explicit edit (rather than just clearing a pending one) —
  // the "customized" state a reset undoes might come from a previously saved
  // server override, not just an in-progress local edit. Custom actions have
  // no built-in default, so resetting them means unbinding entirely.
  const resetRow = (row) => setKey(row.actionId, row.defaultKey ?? "");

  const pickerCommandValid = pickerCommand !== "" && isValidBindingValue(pickerCommand);

  const addCustomBinding = () => {
    if (!pickerCommandValid || !pickerKey) return;
    const actionId = pickerCommand;
    const [panel, command] = actionId.split(".");

    setRows((prev) => ({
      ...prev,
      [actionId]: prev[actionId] ?? {
        actionId,
        panel,
        command,
        label: actionId,
        defaultKey: undefined,
        currentKey: undefined,
      },
    }));
    setKey(actionId, pickerKey);
    setPickerCommand("");
    setPickerKey("");
  };

  // Duplicate-key check across the *desired* end state — informational only.
  const desiredByKey = {};
  for (const row of Object.values(rows)) {
    const key = effectiveKey(row);
    if (!key) continue;
    (desiredByKey[key] ??= []).push(row.label);
  }
  const duplicates = Object.entries(desiredByKey).filter(([, labels]) => labels.length > 1);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {};
      for (const row of Object.values(rows)) {
        const desired = effectiveKey(row);
        if (desired && !KEY_COMBO_REGEX.test(desired)) {
          console.warn(`[KeyboardShortcutsPanel] skipping malformed combo for ${row.actionId}: ${desired}`);
          continue;
        }
        if (row.defaultKey !== undefined) {
          if (desired !== row.defaultKey) {
            payload[row.defaultKey] = "";
            if (desired) payload[desired] = row.actionId;
          }
        } else if (desired) {
          payload[desired] = row.actionId;
        }
      }

      const resp = await saveBindings(payload);
      if (!resp || !resp.ok) {
        toaster.create({ description: "Failed to save keyboard shortcuts.", type: "error", duration: 5000 });
        return;
      }

      // Re-derive rows' currentKey/defaultKey baselines from what was actually
      // persisted, rather than just clearing edits — row.currentKey is only ever
      // set at load time, so without this, a save would look like it silently
      // reverted (stale currentKey) until the panel was reopened.
      await loadRows();
      setEdits({});
      toaster.create({ description: "Keyboard shortcuts saved. Reload the page for the new bindings to take effect in-game.", type: "success", duration: 5000 });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <BasePanel><Text p={3}>Loading…</Text></BasePanel>;

  const grouped = Object.values(rows).reduce((acc, row) => {
    (acc[row.panel] ??= []).push(row);
    return acc;
  }, {});

  return (
    <BasePanel>
      <Flex direction="column" flex="1" width="100%" overflowY="auto" overflowX="hidden" p={2} gap={2}>
        <Text fontSize="xs" color="gray.400" px={1}>
          These bindings are tied to your account, not this game — they'll follow you into every game you join.
        </Text>

        {duplicates.length > 0 && (
          <Box bg="orange.900" borderRadius="md" p={2}>
            {duplicates.map(([key, labels]) => (
              <Text key={key} fontSize="xs" color="orange.200">
                "{key}" is bound to multiple actions: {labels.join(", ")}
              </Text>
            ))}
          </Box>
        )}

        {Object.entries(grouped).map(([panel, panelRows]) => (
          <Stack key={panel} gap={1}>
            <HStack px={1}>
              <Heading size="sm" color="gray.300">{panelLabel(panel)}</Heading>
              <Separator flex="1" borderColor="whiteAlpha.200" />
            </HStack>
            {panelRows.map((row) => (
              <HStack key={row.actionId} justify="space-between" px={2} py={1}>
                <Text fontSize="sm">{row.label}</Text>
                <KeyComboRecorder
                  value={effectiveKey(row)}
                  onChange={(key) => setKey(row.actionId, key)}
                  onReset={() => resetRow(row)}
                  // Default actions: only show once remapped away from their code default.
                  // Custom actions have no default to fall back to — unbinding is the only
                  // "reset", so the affordance must always be available, not just while a
                  // pending edit happens to differ from the last-loaded key.
                  showReset={row.defaultKey !== undefined ? effectiveKey(row) !== row.defaultKey : true}
                  resetLabel={row.defaultKey !== undefined ? "Reset to default" : "Delete binding"}
                />
              </HStack>
            ))}
          </Stack>
        ))}

        <Stack gap={1} mt={2}>
          <HStack px={1}>
            <Heading size="sm" color="gray.300">Add Custom Binding</Heading>
            <Separator flex="1" borderColor="whiteAlpha.200" />
          </HStack>
          <Text fontSize="xs" color="gray.400" px={2}>
            Tip: try the command in Run (Shift+P) first — e.g. "battlemap.CopyElements" — then bind it here.
          </Text>
          <HStack px={2} py={1} gap={2}>
            <Input
              size="sm"
              placeholder="panel.command"
              value={pickerCommand}
              onChange={(e) => setPickerCommand(e.target.value.trim())}
              borderColor={pickerCommand && !pickerCommandValid ? "red.400" : undefined}
            />
            <KeyComboRecorder value={pickerKey} onChange={setPickerKey} showReset={false} />
            <Button size="xs" onClick={addCustomBinding} disabled={!pickerCommandValid || !pickerKey}>
              Add
            </Button>
          </HStack>
          {pickerCommand && !pickerCommandValid && (
            <Text fontSize="xs" color="red.400" px={2}>
              Must look like "panel.command" (e.g. battlemap.CopyElements).
            </Text>
          )}
        </Stack>
      </Flex>

      <Box borderTop="1px solid" borderColor="whiteAlpha.100" pt={2} px={2}>
        <Button size="sm" variant="outline" onClick={handleSave} loading={saving}>
          Save
        </Button>
      </Box>
    </BasePanel>
  );
};

export default KeyboardShortcutsPanel;
