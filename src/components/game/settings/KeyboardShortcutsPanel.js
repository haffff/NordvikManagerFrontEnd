import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import {
  Badge,
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
  MAX_BINDING_VALUE_LENGTH,
  fetchSavedBindings,
  saveBindings,
  isValidBindingValue,
} from "../KeyBoardEventsManager";
import CommandExecutionHelper, { parseCommandString } from "../../../helpers/CommandExecutionHelper";
import { toaster } from "../../ui/toaster";

const actionIdFor = (panel, command) => `${panel}.${command}`;
const panelLabel = (panel) => (panel === "battlemap" ? "Battle Map" : panel === "game" ? "Game" : panel);

// "--name=value" tokens for a parsed args object — the canonical stored form.
// Arg names are sorted so that the same logical binding always serializes to the
// same string regardless of the order the user filled the fields in; otherwise
// "--a=1 --b=2" and "--b=2 --a=1" would be treated as two different bindings.
const serializeArgs = (args) =>
  Object.entries(args ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `--${k}=${v}`)
    .join(" ");

// Compact "k=v, k=v" for row labels.
const argSummary = (args) =>
  Object.entries(args ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

const hasArgs = (args) => Object.keys(args ?? {}).length > 0;

// The canonical binding string / row key: "panel.command" for argless bindings,
// "panel.command --a=1 --b=2" (sorted) otherwise.
const buildActionId = (panel, command, args) => {
  const base = actionIdFor(panel, command);
  const tail = serializeArgs(args);
  return tail ? `${base} ${tail}` : base;
};

// Builds one row per default action, plus one row per still-bound custom
// (server-only) action that isn't part of DefaultShortCuts.
//
// Rows are keyed by the canonical binding string ("panel.command" for defaults,
// "panel.command --a=1 --b=2" with sorted args for arg-bearing customs) rather
// than "panel.command" alone — otherwise two bindings of the same command with
// different args would collide and the second would silently overwrite the
// first. buildActionId canonicalizes so a re-parsed server value and a freshly
// assembled one produce the same id regardless of arg order.
//
// A "" value is a tombstone and just leaves the matching default row on its
// code default.
function buildRows(rawBindings) {
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
      args: undefined,
    };
  }

  for (const [key, rawValue] of Object.entries(rawBindings ?? {})) {
    if (!rawValue || !isValidBindingValue(rawValue)) continue;
    const { panel, command, args } = parseCommandString(rawValue);
    const defaultId = actionIdFor(panel, command);

    // Plain "panel.command" that matches a default → just a remapped key.
    if (!hasArgs(args) && rows[defaultId]) {
      rows[defaultId].currentKey = key;
      continue;
    }

    const id = buildActionId(panel, command, args);
    rows[id] = {
      actionId: id,
      panel,
      command,
      label: hasArgs(args) ? `${command} (${argSummary(args)})` : id,
      defaultKey: undefined,
      currentKey: key,
      args,
    };
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

  // "Add Custom Binding" combobox / arg-editor state.
  const argListId = React.useId();
  const [commandQuery, setCommandQuery] = React.useState("");
  const [selectedSuggestion, setSelectedSuggestion] = React.useState(null);
  const [argValues, setArgValues] = React.useState({});        // argName -> string
  const [argCompletions, setArgCompletions] = React.useState({}); // argName -> [{value,label}]

  const loadRows = React.useCallback(async () => {
    const bindings = await fetchSavedBindings();
    setRows(buildRows(bindings));
  }, []);

  React.useEffect(() => {
    loadRows().finally(() => setLoading(false));
  }, [loadRows]);

  // Populate the command suggestion index once (same source the Run dialog uses)
  // so the "Add Custom Binding" combobox can autocomplete panel.command names
  // and surface each command's documented arguments.
  const [suggestionsLoaded, setSuggestionsLoaded] = React.useState(false);
  React.useEffect(() => {
    try {
      CommandExecutionHelper.LoadSuggestions();
    } catch (e) {
      console.warn("[KeyboardShortcutsPanel] failed to load command suggestions", e);
    }
    setSuggestionsLoaded(true);
  }, []);

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

  // ── command autofill (combobox) ───────────────────────────────────────────────
  const suggestions = React.useMemo(() => {
    if (!commandQuery) return [];
    try {
      return CommandExecutionHelper.GetSuggestions(commandQuery).slice(0, 8);
    } catch {
      return [];
    }
  }, [commandQuery, suggestionsLoaded]);

  // Args the mini editor can actually fill: skip the synthetic BM 'context' arg
  // (resolved at fire time) and free-form 'object' args (no sensible text field).
  const editableArgs = React.useMemo(
    () => (selectedSuggestion?.args ?? []).filter((a) => a.name !== "context" && a.type !== "object"),
    [selectedSuggestion]
  );

  const assembleCommand = React.useCallback((sugg, values) => {
    if (!sugg) return;
    const filled = {};
    for (const [k, v] of Object.entries(values)) {
      if (v !== undefined && String(v).trim() !== "") filled[k] = String(v).trim();
    }
    setPickerCommand(buildActionId(sugg.panel, sugg.command, filled));
  }, []);

  const chooseSuggestion = (sugg) => {
    setSelectedSuggestion(sugg);
    setArgValues({});
    setCommandQuery("");
    assembleCommand(sugg, {});
  };

  const setArgValue = (name, value) => {
    setArgValues((prev) => {
      const next = { ...prev, [name]: value };
      assembleCommand(selectedSuggestion, next);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedSuggestion(null);
    setArgValues({});
    setArgCompletions({});
  };

  // Live value completions for typed args (resourceid, mapid, playerid, …) —
  // string/number/boolean args have no list, so they stay plain text inputs.
  React.useEffect(() => {
    if (!selectedSuggestion) {
      setArgCompletions({});
      return;
    }
    let cancelled = false;
    (async () => {
      const out = {};
      for (const arg of editableArgs) {
        if (!arg.type || ["string", "number", "boolean"].includes(arg.type)) continue;
        try {
          const list = await CommandExecutionHelper.GetArgCompletions(arg.type);
          if (list?.length) out[arg.name] = list;
        } catch (e) {
          console.warn("[KeyboardShortcutsPanel] arg completion failed for", arg.type, e);
        }
      }
      if (!cancelled) setArgCompletions(out);
    })();
    return () => { cancelled = true; };
  }, [selectedSuggestion, editableArgs]);

  const addCustomBinding = () => {
    if (!pickerCommandValid || !pickerKey) return;
    // Canonicalize whatever was typed/assembled so the row id matches the form
    // buildRows produces from a saved value (sorted args, no stray whitespace).
    const { panel, command, args } = parseCommandString(pickerCommand.trim());
    const actionId = buildActionId(panel, command, args);

    // The panel models one row (= one key) per distinct command+args. Re-adding
    // the same binding just moves its key rather than creating a second row —
    // say so instead of silently overwriting.
    if (rows[actionId] && effectiveKey(rows[actionId])) {
      toaster.create({
        description: `"${actionId}" is already listed — its key was updated to ${pickerKey}.`,
        type: "info",
        duration: 4000,
      });
    }

    setRows((prev) => ({
      ...prev,
      [actionId]: prev[actionId] ?? {
        actionId,
        panel,
        command,
        label: hasArgs(args) ? `${command} (${argSummary(args)})` : actionId,
        defaultKey: undefined,
        currentKey: undefined,
        args,
      },
    }));
    setKey(actionId, pickerKey);
    setPickerCommand("");
    setPickerKey("");
    clearSelection();
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
      const skipped = [];
      for (const row of Object.values(rows)) {
        const desired = effectiveKey(row);
        if (desired && !KEY_COMBO_REGEX.test(desired)) {
          console.warn(`[KeyboardShortcutsPanel] skipping malformed combo for ${row.actionId}: ${desired}`);
          continue;
        }
        // The server rejects the entire save if any value exceeds the limit —
        // drop the offending binding and warn rather than lose every change.
        if (desired && row.defaultKey === undefined && row.actionId.length > MAX_BINDING_VALUE_LENGTH) {
          skipped.push(row.label);
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

      if (skipped.length) {
        toaster.create({
          description: `Some bindings were too long and skipped: ${skipped.join(", ")}`,
          type: "warning",
          duration: 6000,
        });
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
            Search a command to autofill it, fill any arguments below, then record a key.
            You can also type a <Text as="span" fontFamily="mono">panel.command</Text> directly.
          </Text>

          {/* Command search / autofill */}
          <Box px={2} py={1} position="relative">
            <Input
              size="sm"
              placeholder="Search commands… (e.g. PlaySound)"
              value={commandQuery}
              onChange={(e) => setCommandQuery(e.target.value)}
            />
            {suggestions.length > 0 && (
              <Stack
                gap={0}
                mt={1}
                bg="gray.800"
                borderWidth="1px"
                borderColor="whiteAlpha.200"
                borderRadius="md"
                maxH="220px"
                overflowY="auto"
                zIndex={2}
              >
                {suggestions.map((s) => (
                  <Box
                    as="button"
                    type="button"
                    key={`${s.panel}.${s.command}`}
                    textAlign="left"
                    px={3}
                    py={2}
                    _hover={{ bg: "whiteAlpha.100" }}
                    onClick={() => chooseSuggestion(s)}
                  >
                    <HStack gap={1} flexWrap="wrap">
                      <Text fontSize="sm" color="gray.400">{s.panel}.</Text>
                      <Text fontSize="sm" fontWeight="bold">{s.command}</Text>
                      {s.requiresContext && (
                        <Badge size="sm" colorPalette="orange" variant="subtle">BM context</Badge>
                      )}
                    </HStack>
                    {s.description && (
                      <Text fontSize="xs" color="gray.500" mt={0.5}>{s.description}</Text>
                    )}
                  </Box>
                ))}
              </Stack>
            )}
          </Box>

          {/* Arg editor for the selected command */}
          {selectedSuggestion && editableArgs.length > 0 && (
            <Stack gap={1} px={2} py={1}>
              <Text fontSize="xs" color="gray.400">
                Arguments for {selectedSuggestion.panel}.{selectedSuggestion.command}
              </Text>
              {editableArgs.map((arg) => {
                const completions = argCompletions[arg.name];
                const listId = completions ? `${argListId}-${arg.name}` : undefined;
                return (
                  <HStack key={arg.name} gap={2}>
                    <Badge size="sm" minW="90px" variant="outline" colorPalette={arg.required ? "blue" : "gray"}>
                      {arg.required ? "" : "?"}{arg.name}{arg.type && arg.type !== "string" ? `: ${arg.type}` : ""}
                    </Badge>
                    <Input
                      size="xs"
                      flex="1"
                      list={listId}
                      placeholder={arg.required ? "required" : "optional"}
                      value={argValues[arg.name] ?? ""}
                      onChange={(e) => setArgValue(arg.name, e.target.value)}
                    />
                    {completions && (
                      <datalist id={listId}>
                        {completions.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </datalist>
                    )}
                  </HStack>
                );
              })}
            </Stack>
          )}

          {/* Resulting binding string + key recorder */}
          <HStack px={2} py={1} gap={2}>
            <Input
              size="sm"
              placeholder="panel.command"
              value={pickerCommand}
              onChange={(e) => {
                setPickerCommand(e.target.value);
                if (selectedSuggestion) clearSelection();
              }}
              borderColor={pickerCommand && !pickerCommandValid ? "red.400" : undefined}
            />
            <KeyComboRecorder value={pickerKey} onChange={setPickerKey} showReset={false} />
            <Button size="xs" onClick={addCustomBinding} disabled={!pickerCommandValid || !pickerKey}>
              Add
            </Button>
          </HStack>
          {pickerCommand && !pickerCommandValid && (
            <Text fontSize="xs" color="red.400" px={2}>
              Must look like "panel.command" (optionally followed by --name=value arguments), max {MAX_BINDING_VALUE_LENGTH} chars.
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
