import * as React from "react";
import {
  Badge, Box, Button, createListCollection, Field, Flex, For, HStack, IconButton, Input, Tabs, Text,
} from "@chakra-ui/react";
import { FaBolt, FaFileExport, FaRedo, FaSave, FaTrash, FaUndo } from "react-icons/fa";
import { Switch } from "../../../../ui/switch";
import { SelectContent, SelectItem, SelectItemGroup, SelectRoot, SelectTrigger, SelectValueText } from "../../../../ui/select";
import { StepList } from "./StepList";
import { StepInspector } from "./StepInspector";
import { StepPicker } from "./StepPicker";
import { RunBar } from "./RunBar";
import { useActionTrace } from "./useActionTrace";
import { stepOps } from "./useActionDraft";
import { computeInputs, variablesAvailableAt } from "./variableScope";
import { T } from "./editorTheme";

// Editor for one action. `draft` comes from useActionDraft (owned by ActionsPanel so it can
// warn about unsaved changes when switching actions).

const PERMISSION_ITEMS = [
  { name: "Not set", value: "" },
  { name: "None", value: "0" },
  { name: "Read", value: "1" },
  { name: "Execute", value: "2" },
  { name: "Read + Execute", value: "3" },
  { name: "Edit", value: "8" },
  { name: "All", value: "31" },
];
const NARROW_WIDTH = 720;

export const fullActionName = (a) => (a?.prefix ? `${a.prefix}/${a.name}` : a?.name ?? "");

const useWidth = (ref) => {
  const [width, setWidth] = React.useState(1000);
  React.useEffect(() => {
    if (!ref.current || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return width;
};

const SettingsTab = ({ action, update, hooks, onExport, onDelete }) => {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  // "None" has no HookMeta on the server, so it isn't in the list; add it so an action can go
  // back to being called by name only.
  const hookItems = React.useMemo(
    () => [{ value: 0, name: "Called by name (no trigger)", category: " " }, ...hooks]
      .map((h) => ({ ...h, value: String(h.value) })), [hooks]);
  const hookCollection = React.useMemo(() => createListCollection({ items: hookItems }), [hookItems]);
  const permCollection = React.useMemo(() => createListCollection({ items: PERMISSION_ITEMS }), []);
  const hooksByCategory = React.useMemo(() => {
    const map = {};
    hookItems.forEach((h) => { (map[h.category || "General"] ??= []).push(h); });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [hookItems]);
  const hook = hooks.find((h) => Number(h.value) === Number(action.hook));
  const permVal = (v) => (v == null ? "" : String(v));

  return (
    <Flex direction="column" gap={4} p={4} maxW="640px">
      <HStack gap={3} align="flex-end">
        <Field.Root w="180px">
          <Field.Label fontSize="xs" color="gray.400">Prefix (group)</Field.Label>
          <Input size="sm" value={action.prefix ?? ""} onChange={(e) => update({ prefix: e.target.value }, "prefix")} />
        </Field.Root>
        <Field.Root>
          <Field.Label fontSize="xs" color="gray.400">Name</Field.Label>
          <Input size="sm" value={action.name ?? ""} onChange={(e) => update({ name: e.target.value }, "name")} />
        </Field.Root>
      </HStack>
      <Field.Root>
        <Field.Label fontSize="xs" color="gray.400">Description</Field.Label>
        <Input size="sm" placeholder="What does this action do?" value={action.description ?? ""}
          onChange={(e) => update({ description: e.target.value }, "description")} />
      </Field.Root>

      <Field.Root>
        <Field.Label fontSize="xs" color="gray.400">Trigger</Field.Label>
        <SelectRoot collection={hookCollection} value={[String(action.hook ?? 0)]} size="sm"
          onValueChange={(e) => update({ hook: Number(e.value[0]) })}>
          <SelectTrigger><SelectValueText placeholder="Called by name">{(items) => items[0]?.name ?? "Called by name"}</SelectValueText></SelectTrigger>
          <SelectContent>
            {hooksByCategory.map(([category, items]) => (
              <SelectItemGroup key={category} label={category}>
                {items.map((h) => <SelectItem key={h.value} item={h}>{h.name}</SelectItem>)}
              </SelectItemGroup>
            ))}
          </SelectContent>
        </SelectRoot>
        <Text fontSize="xs" color={T.muted} mt={1}>
          {hook ? hook.description : "No trigger: the action runs when something calls it by name (a card button, a menu item, another action)."}
        </Text>
        {hook?.variables?.length > 0 && (
          <Text fontSize="xs" color={T.muted}>Gives the action: {hook.variables.map((v) => `%${v}%`).join(", ")}</Text>
        )}
      </Field.Root>

      <Field.Root>
        <Field.Label fontSize="xs" color="gray.400">Permission for all players</Field.Label>
        <SelectRoot collection={permCollection} size="sm" value={[permVal(action.genericPermission)]}
          onValueChange={(e) => update({ genericPermission: e.value[0] === "" ? null : parseInt(e.value[0], 10) })}>
          <SelectTrigger><SelectValueText placeholder="Not set">{(items) => items[0]?.name ?? "Not set"}</SelectValueText></SelectTrigger>
          <SelectContent>
            <For each={permCollection.items}>{(o) => <SelectItem key={o.value} item={o}>{o.name}</SelectItem>}</For>
          </SelectContent>
        </SelectRoot>
      </Field.Root>

      <HStack gap={2} pt={2} borderTopWidth="1px" borderColor={T.border}>
        <Button size="sm" variant="ghost" onClick={onExport}><FaFileExport /> Export JSON</Button>
        <Box flex={1} />
        {confirmDelete ? (
          <HStack gap={2}>
            <Text fontSize="sm" color="red.300">Delete this action?</Text>
            <Button size="sm" colorPalette="red" variant="outline" onClick={onDelete}>Delete</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </HStack>
        ) : (
          <Button size="sm" colorPalette="red" variant="ghost" onClick={() => setConfirmDelete(true)}><FaTrash /> Delete action</Button>
        )}
      </HStack>
    </Flex>
  );
};

export const ActionEditor = ({ draft, stepDefinitions, hooks, actions, onSave, onDelete, onOpenAction }) => {
  const { action, steps } = draft;
  const [tab, setTab] = React.useState("steps");
  const [selectedId, setSelectedId] = React.useState(null);
  const [insertAt, setInsertAt] = React.useState(null); // index for the step picker, or null
  const bodyRef = React.useRef(null);
  const narrow = useWidth(bodyRef) < NARROW_WIDTH;
  const trace = useActionTrace();

  React.useEffect(() => { setSelectedId(null); trace.clear(); }, [action?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const defsByType = React.useMemo(
    () => Object.fromEntries((stepDefinitions ?? []).map((d) => [d.value, d])), [stepDefinitions]);
  const hook = hooks.find((h) => Number(h.value) === Number(action.hook ?? 0));
  const hookVariables = hook?.variables ?? [];
  const calledByName = !Number(action.hook ?? 0); // 0 / null = no trigger
  const inputs = React.useMemo(
    () => (calledByName ? computeInputs(steps, defsByType, hookVariables) : []),
    [steps, defsByType, calledByName, hookVariables]);

  const actionOptions = React.useMemo(() => (actions ?? []).map((a) => ({
    value: fullActionName(a),
    label: fullActionName(a),
    hint: hooks.find((h) => Number(h.value) === Number(a.hook))?.name ?? (a.isEnabled ? "" : "off"),
  })), [actions, hooks]);

  const selectedIndex = steps.findIndex((s) => s.id === selectedId);
  const selected = selectedIndex >= 0 ? steps[selectedIndex] : null;
  const available = React.useMemo(
    () => (selectedIndex >= 0 ? variablesAvailableAt(steps, selectedIndex, defsByType, hookVariables, inputs) : []),
    [steps, selectedIndex, defsByType, hookVariables, inputs]);
  const knownNames = React.useMemo(() => new Set(available.map((v) => v.name)), [available]);

  const save = () => { onSave(draft.payload()); draft.markSaved(); };
  const traceFor = (step, i) => trace.byStep[step.id] ?? trace.byIndex[i];

  const onKeyDown = (e) => {
    e.stopPropagation(); // keep editor keys away from game shortcuts (e.g. Delete removes map elements)
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const key = e.key.toLowerCase();
    if (key === "s") { e.preventDefault(); save(); return; }
    if (e.target.closest?.(".cm-editor")) return; // the code editor has its own undo
    if (key === "z" && !e.shiftKey) { e.preventDefault(); draft.undo(); }
    else if ((key === "z" && e.shiftKey) || key === "y") { e.preventDefault(); draft.redo(); }
  };

  const exportJson = () => {
    const payload = { ...action, hook: parseInt(action.hook ?? 0, 10), content: steps };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (action.name ?? "action").replaceAll(" ", "_") + ".json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  const list = (
    <Flex direction="column" gap={2} p={3} minW={0}>
      {calledByName && inputs.length > 0 && (
        <Text fontSize="xs" color={T.muted}>
          Inputs (passed in by whoever calls this action):{" "}
          {inputs.map((n) => <Text as="span" key={n} fontFamily="mono" color={T.token}>%{n}% </Text>)}
        </Text>
      )}
      <RunBar actionId={action.id} inputs={inputs} running={trace.running} result={trace.result} dirty={draft.dirty}
        onRun={(args) => { if (draft.dirty) save(); trace.run(fullActionName(action), args); }} />
      <StepList
        steps={steps} defsByType={defsByType} selectedId={selectedId} traceFor={traceFor}
        onSelect={setSelectedId}
        onMove={(from, to) => draft.setSteps((s) => stepOps.move(s, from, to))}
        onInsert={(i) => setInsertAt(i)}
        onDuplicate={(id) => draft.setSteps((s) => stepOps.duplicate(s, id))}
        onDelete={(id) => { draft.setSteps((s) => stepOps.remove(s, id)); if (id === selectedId) setSelectedId(null); }}
        onOpenAction={onOpenAction}
      />
    </Flex>
  );

  const inspector = (
    <StepInspector
      step={selected} index={selectedIndex} def={selected ? defsByType[selected.Type] : null}
      stepDefinitions={stepDefinitions} variables={available} knownNames={knownNames}
      actionOptions={actionOptions} trace={selected ? traceFor(selected, selectedIndex) : null}
      onChangeType={(type) => draft.updateStep(selected.id, (s) => ({ ...s, Type: type }))}
      onChangeData={(name, value) =>
        draft.updateStep(selected.id, (s) => ({ ...s, Data: { ...s.Data, [name]: value } }), `${selected.id}.${name}`)}
      onFieldBlur={draft.breakMerge}
    />
  );

  return (
    <Flex direction="column" flex={1} overflow="hidden" onKeyDown={onKeyDown} onKeyUp={(e) => e.stopPropagation()}>
      {/* header */}
      <HStack px={3} py={2} gap={3} flexShrink={0} borderBottomWidth="1px" borderColor={T.border} bg={T.surface} flexWrap="wrap">
        <Switch size="sm" checked={!!action.isEnabled} onCheckedChange={(e) => draft.updateAction({ isEnabled: e.checked })} />
        <Text fontSize="sm" color="gray.200" fontWeight="semibold" truncate>
          {action.prefix && <Text as="span" color={T.muted}>{action.prefix} / </Text>}
          {action.name || <Text as="span" color={T.faint} fontStyle="italic">Unnamed</Text>}
        </Text>
        <Badge size="sm" variant="subtle" colorPalette={hook ? "purple" : "gray"} title={hook?.description}>
          <FaBolt /> {hook ? hook.name : "Called by name"}
        </Badge>
        {!action.isEnabled && hook && <Badge size="sm" variant="subtle" colorPalette="orange">trigger off</Badge>}
        <Box flex={1} />
        {draft.dirty && <Text fontSize="xs" color="orange.300">● Unsaved</Text>}
        <IconButton size="xs" variant="ghost" aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" disabled={!draft.canUndo} onClick={draft.undo}><FaUndo /></IconButton>
        <IconButton size="xs" variant="ghost" aria-label="Redo (Ctrl+Shift+Z)" title="Redo (Ctrl+Shift+Z)" disabled={!draft.canRedo} onClick={draft.redo}><FaRedo /></IconButton>
        <Button size="xs" colorPalette="blue" variant={draft.dirty ? "solid" : "outline"} onClick={save} title="Save (Ctrl+S)">
          <FaSave /> Save
        </Button>
      </HStack>

      <Tabs.Root value={tab} onValueChange={(e) => setTab(e.value)} display="flex" flexDirection="column" flex={1} overflow="hidden" size="sm">
        <Tabs.List flexShrink={0} px={2}>
          <Tabs.Trigger value="steps">Steps <Badge size="xs" ml={1} variant="subtle">{steps.length}</Badge></Tabs.Trigger>
          <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="steps" flex={1} overflow="hidden" p={0}>
          <Flex ref={bodyRef} h="100%" direction={narrow ? "column" : "row"} overflow={narrow ? "auto" : "hidden"}>
            <Box flex={narrow ? "none" : 1} overflowY={narrow ? "visible" : "auto"} minW={0}>{list}</Box>
            <Box
              w={narrow ? "100%" : "42%"} flexShrink={0} overflowY={narrow ? "visible" : "auto"}
              borderLeftWidth={narrow ? 0 : "1px"} borderTopWidth={narrow ? "1px" : 0} borderColor={T.border} bg={T.surface}
            >
              {inspector}
            </Box>
          </Flex>
        </Tabs.Content>
        <Tabs.Content value="settings" flex={1} overflowY="auto" p={0}>
          <SettingsTab action={action} update={draft.updateAction} hooks={hooks} onExport={exportJson} onDelete={onDelete} />
        </Tabs.Content>
      </Tabs.Root>

      <StepPicker
        open={insertAt !== null} onClose={() => setInsertAt(null)} stepDefinitions={stepDefinitions}
        onPick={(d) => {
          const step = stepOps.newStep(d.value);
          draft.setSteps((s) => stepOps.insertAt(s, insertAt ?? s.length, step));
          setSelectedId(step.id);
        }}
      />
    </Flex>
  );
};

export default ActionEditor;
