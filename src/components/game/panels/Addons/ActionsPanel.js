import * as React from "react";
import {
  Badge,
  Box,
  Button,
  createListCollection,
  Field,
  Flex,
  For,
  Heading,
  HStack,
  Input,
  Separator,
  Spinner,
  Text,
} from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import WebSocketManagerInstance from "../../WebSocketManager";
import { ActiveWebHelper as WebHelper } from "../../../../helpers/transport";
import CollectionSyncer from "../../../uiComponents/base/CollectionSyncer";
import { ActionStep } from "./ActionStep";
import UtilityHelper from "../../../../helpers/UtilityHelper";
import { ReactTreeList } from "@bartaxyz/react-tree-list";
import { FaCheck, FaMinus, FaPlay, FaPlus, FaSave, FaTrash, FaFileExport } from "react-icons/fa";
import { Switch } from "../../../ui/switch";
import {  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "../../../ui/select";
import { SearchInput } from "../../../uiComponents/SearchInput";
import DListItemButton from "../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import { ResizeDivider, useDragResize } from "../../../uiComponents/ResizeDivider";

// ─── design tokens (matches index.css variables) ──────────────────────────────
const BG_SURFACE  = "rgb(38,38,38)";
const BG_RAISED   = "rgb(48,48,48)";
const BORDER_CLR  = "rgb(65,65,65)";

// ─── FieldRow — label + control pair ─────────────────────────────────────────
const FieldRow = ({ label, children }) => (
  <Field.Root>
    <Field.Label fontSize="xs" color="gray.400" mb="2px">{label}</Field.Label>
    {children}
  </Field.Root>
);

// ─── SectionHeader — thin separator with title ───────────────────────────────
const SectionHeader = ({ children }) => (
  <HStack gap={2} mt={1}>
    <Text fontSize="xs" fontWeight="semibold" color="gray.500" whiteSpace="nowrap" textTransform="uppercase" letterSpacing="wider">
      {children}
    </Text>
    <Separator flex={1} borderColor={BORDER_CLR} />
  </HStack>
);

// ─── GroupPane ────────────────────────────────────────────────────────────────
const GroupPane = React.memo(({ group, actions }) => {
  const [confirmRun, setConfirmRun] = React.useState(false);
  const groupActions = actions.filter((x) => x.prefix === group);

  const runAll = () => {
    groupActions.forEach((a) =>
      WebSocketManagerInstance.Send({ command: "execute_action", data: { Action: a.name } })
    );
    setConfirmRun(false);
  };

  return (
    <Flex direction="column" flex={1} p={5} gap={4} overflowY="auto">
      <Box>
        <Heading size="md" color="white">{group}</Heading>
        <Text fontSize="sm" color="gray.400" mt={1}>
          {groupActions.length} action{groupActions.length !== 1 ? "s" : ""} in this group
        </Text>
      </Box>

      <Separator borderColor={BORDER_CLR} />

      {/* Actions list preview */}
      <Flex direction="column" gap={1}>
        {groupActions.map((a) => (
          <HStack key={a.id} px={3} py={2}
            bg={BG_RAISED} borderRadius="md" borderWidth="1px" borderColor={BORDER_CLR}>
            <Badge size="sm" colorPalette={a.isEnabled ? "green" : "gray"} variant="subtle" flexShrink={0}>
              {a.isEnabled ? "On" : "Off"}
            </Badge>
            <Text fontSize="sm" flex={1} color="white">{a.name}</Text>
          </HStack>
        ))}
      </Flex>

      {/* Run all — two-step */}
      <Box>
        {confirmRun ? (
          <HStack gap={2}>
            <Text fontSize="sm" color="orange.300">Run all {groupActions.length} actions?</Text>
            <Button size="sm" colorPalette="orange" variant="outline" onClick={runAll}>Confirm</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmRun(false)}>Cancel</Button>
          </HStack>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setConfirmRun(true)}>
            <FaPlay /> Run all
          </Button>
        )}
      </Box>
    </Flex>
  );
});

// ─── ActionPane ───────────────────────────────────────────────────────────────
const ActionPane = React.memo(({
  selectedAction, setSelectedAction,
  steps, stepsRef, setSteps,
  stepDefinitions, hooksCollection,
}) => {
  const [confirmDelete,    setConfirmDelete   ] = React.useState(false);
  const [inputArguments,   setInputArguments  ] = React.useState("");

  const handleUpdate = () => {
    const payload = { ...selectedAction, content: JSON.stringify(stepsRef.current) };
    WebSocketManagerInstance.Send({ command: "action_update", data: payload });
  };

  const handleDelete = () => {
    WebSocketManagerInstance.Send({ command: "action_delete", data: selectedAction.id });
    setConfirmDelete(false);
  };

  const handleExport = () => {
    const payload = { ...selectedAction, hook: parseInt(selectedAction.hook, 10) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (selectedAction.name ?? "action").replaceAll(" ", "_") + ".json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };
  const handleRun = () => {
    let args;
    if (inputArguments.trim()) {
      try { args = JSON.parse(inputArguments); } catch { args = inputArguments; }
    }    WebSocketManagerInstance.Send({
      command: "execute_action",
      data: { Action: selectedAction.name, ...(args !== undefined && { Args: args }) },
    });
  };

  const set = (patch) => setSelectedAction({ ...selectedAction, ...patch });

  return (
    <Flex direction="column" flex={1} overflow="hidden">
      {/* ── sticky header ── */}
      <HStack
        px={4} py={3} flexShrink={0} gap={3} flexWrap="wrap"
        borderBottomWidth="1px" borderColor={BORDER_CLR} bg={BG_SURFACE}
      >
        <Switch
          checked={selectedAction.isEnabled}
          onCheckedChange={(e) => set({ isEnabled: e.checked })}
        />
        <Badge
          colorPalette={selectedAction.isEnabled ? "green" : "gray"}
          variant="subtle" fontSize="xs"
        >
          {selectedAction.isEnabled ? "Active" : "Disabled"}
        </Badge>        <Text fontSize="sm" color="gray.300" flex={1} fontWeight="medium" noOfLines={1}>
          {selectedAction.prefix && <Text as="span" color="gray.500">{selectedAction.prefix} / </Text>}
          {selectedAction.name || <Text as="span" color="gray.600" fontStyle="italic">Unnamed</Text>}
        </Text>
        <Input
          size="xs"
          w="160px"
          placeholder='Args (JSON…)'
          value={inputArguments}
          onChange={(e) => setInputArguments(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleRun(); }}
          fontFamily="mono"
          borderColor={BORDER_CLR}
          _placeholder={{ color: "gray.600", fontSize: "10px" }}
        />
        <Button size="xs" variant="ghost" onClick={handleRun} color="green.300">
          <FaPlay /> Run
        </Button>
      </HStack>

      {/* ── scrollable body ── */}
      <Flex direction="column" flex={1} overflowY="auto" p={4} gap={5}>

        {/* Identity */}
        <Box>
          <SectionHeader>Identity</SectionHeader>
          <Flex gap={3} mt={2} direction="column">
            <HStack gap={3} align="flex-end">
              <FieldRow label="Prefix">
                <Input
                  size="sm" width="150px"
                  value={selectedAction.prefix ?? ""}
                  onChange={(e) => set({ prefix: e.target.value })}
                />
              </FieldRow>
              <FieldRow label="Name">
                <Input
                  size="sm"
                  value={selectedAction.name ?? ""}
                  onChange={(e) => set({ name: e.target.value })}
                />
              </FieldRow>
            </HStack>
            <FieldRow label="Description">
              <Input
                size="sm"
                placeholder="Optional description…"
                value={selectedAction.description ?? ""}
                onChange={(e) => set({ description: e.target.value })}
              />
            </FieldRow>
          </Flex>
        </Box>

        {/* Trigger */}
        <Box>
          <SectionHeader>Trigger</SectionHeader>
          <Box mt={2}>
            <SelectRoot
              multiple={false}
              collection={hooksCollection}
              value={[selectedAction.hook]}
              onValueChange={(e) => set({ hook: e.value[0] })}
              size="sm"
            >
              <SelectTrigger>
                <SelectValueText placeholder="Select trigger…">
                  {(items) => <>{items[0]?.name ?? "Select trigger…"}</>}
                </SelectValueText>
              </SelectTrigger>
              <SelectContent>
                <For each={hooksCollection.items}>
                  {(option) => (
                    <SelectItem key={option.value} item={option} value={option.value}
                      selected={selectedAction.hook === option.value}>
                      {option.name}
                    </SelectItem>
                  )}
                </For>
              </SelectContent>
            </SelectRoot>
          </Box>
        </Box>

        {/* Steps */}
        <Box>
          <HStack gap={2} mt={1}>
            <Text fontSize="xs" fontWeight="semibold" color="gray.500"
              textTransform="uppercase" letterSpacing="wider">
              Steps
            </Text>
            <Badge variant="subtle" colorPalette="blue" fontSize="2xs">{steps.length}</Badge>
            <Separator flex={1} borderColor={BORDER_CLR} />
            <Button size="xs" variant="ghost" color="blue.300"
              onClick={() => setSteps([
                ...stepsRef.current,
                { id: UtilityHelper.GenerateUUID(), Data: { Label: "New Step" }, Type: "SetVariable" },
              ])}
            >
              <FaPlus /> Add step
            </Button>
          </HStack>

          <Flex direction="column" gap={2} mt={2}>
            {steps.length === 0 ? (
              <Text fontSize="sm" color="gray.600" fontStyle="italic" py={2}>
                No steps yet. Add one above.
              </Text>
            ) : steps.map((x, i) => (
              <ActionStep
                key={x.id}
                stepIndex={i}
                initStep={x}
                stepDefinitions={stepDefinitions}
                stepsRef={stepsRef}
                setSteps={setSteps}
                actionId={selectedAction.id}
              />
            ))}
          </Flex>
        </Box>
      </Flex>

      {/* ── pinned footer ── */}
      <HStack
        px={4} py={3} gap={2} flexShrink={0} flexWrap="wrap"
        borderTopWidth="1px" borderColor={BORDER_CLR} bg={BG_SURFACE}
      >
        <Button size="sm" colorPalette="blue" variant="outline" onClick={handleUpdate}>
          <FaSave /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={handleExport} color="gray.300">
          <FaFileExport /> Export
        </Button>
        <Box flex={1} />
        {confirmDelete ? (
          <HStack gap={2}>
            <Text fontSize="sm" color="red.300">Delete this action?</Text>
            <Button size="sm" colorPalette="red" variant="outline" onClick={handleDelete}>Confirm</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </HStack>
        ) : (
          <Button size="sm" colorPalette="red" variant="ghost"
            onClick={() => setConfirmDelete(true)}>
            <FaTrash /> Delete
          </Button>
        )}
      </HStack>
    </Flex>
  );
});

// ─── EmptyPane ────────────────────────────────────────────────────────────────
const EmptyPane = () => (
  <Flex direction="column" flex={1} align="center" justify="center" gap={3} color="gray.600">
    <FaPlay size={28} opacity={0.2} />
    <Text fontSize="sm">Select an action or group</Text>
  </Flex>
);

// ─── main component ───────────────────────────────────────────────────────────
export const ActionsPanel = ({ state, gameDataRef }) => {
  const [actions,         setActions]         = React.useState([]);
  const [hooks,           setHooks]           = React.useState([]);
  const [stepDefinitions, setStepDefinitions] = React.useState([]);
  const [search,          setSearch]          = React.useState("");
  const [loading,         setLoading]         = React.useState(true);
  const [selection,       setSelection]       = React.useState(null);

  const [steps,  setSteps]  = React.useState([]);
  const stepsRef            = React.useRef(steps);
  stepsRef.current          = steps;

  const [treeData, setTreeData] = React.useState([]);

  // Resizable sidebar
  const colContainerRef = React.useRef(null);
  const { fracs, onDividerMouseDown } = useDragResize(colContainerRef, [0.3]);

  const hooksCollection = React.useMemo(
    () => createListCollection({ items: hooks }),
    [hooks]
  );

  // ── initial load ─────────────────────────────────────────────────────────────
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [actionsData, stepDefsWrapped, hooksData] = await Promise.all([
          WebHelper.getAsync("addon/actions"),
          WebHelper.getAsync("addon/stepdefinitions"),
          WebHelper.getAsync("addon/hooks"),
        ]);
        if (cancelled) return;
        setActions(actionsData ?? []);
        setStepDefinitions(stepDefsWrapped?.stepDefinitions ?? []);
        setHooks(hooksData ?? []);
      } catch (err) {
        console.warn("[ActionsPanel] load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // ── tree generation ───────────────────────────────────────────────────────────
  const generateActionsTree = React.useCallback((actionList, currentSearch, currentTreeData) => {
    const filtered = actionList.filter((x) =>
      x?.name?.toLowerCase().includes(currentSearch.toLowerCase())
    );
    const grouped = Object.groupBy(filtered, (x) => x.prefix);
    return Object.keys(grouped).map((prefix) => ({
      id: prefix, label: prefix, isGroup: true,
      open: currentTreeData.find((y) => y.id === prefix)?.open ?? false,
      children: grouped[prefix].map((y) => ({
        id: y.id, label: y.name,
        icon: y.isEnabled ? <FaCheck color="#48BB78" /> : <FaMinus color="#718096" />,
      })),
    }));
  }, []);

  React.useEffect(() => {
    setTreeData((prev) => generateActionsTree(actions, search, prev));
  }, [actions, search, generateActionsTree]);

  // ── selection ─────────────────────────────────────────────────────────────────
  const selectItem = React.useCallback(async ({ id, isGroup, label }) => {
    if (isGroup) {
      setSelection({ type: "group", label });
      setSteps([]);
      return;
    }
    try {
      const response = await WebHelper.getAsync("addon/action?id=" + id);
      setSelection({ type: "action", action: response });
      setSteps(JSON.parse(response.content ?? "[]"));
    } catch (err) {
      console.warn("[ActionsPanel] failed to load action:", err);
    }
  }, []);

  const selectedAction = selection?.type === "action" ? selection.action : null;
  const setSelectedAction = React.useCallback(
    (next) => setSelection((s) => ({
      type: "action",
      action: typeof next === "function" ? next(s?.action) : next,
    })),
    []
  );

  const ctx = Dockable.useContentContext();
  ctx.setTitle("Actions");

  return (
    <>
      <CollectionSyncer commandPrefix="action" collection={actions} setCollection={setActions} />      <Flex height="100%" overflow="hidden" ref={colContainerRef}>
        {/* ── left sidebar ── */}
        <Flex
          direction="column" width={`${fracs[0] * 100}%`} flexShrink={0}
          bg={BG_SURFACE} overflow="hidden"
        >
          {/* Sidebar header */}
          <HStack
            px={3} py={2} flexShrink={0} gap={2}
            borderBottomWidth="1px" borderColor={BORDER_CLR}
          >
            <Text fontSize="xs" fontWeight="semibold" color="gray.400"
              textTransform="uppercase" letterSpacing="wider" flex={1}>
              Actions
            </Text>
            {!loading && (
              <Badge variant="subtle" colorPalette="gray" fontSize="2xs">{actions.length}</Badge>
            )}
            <DListItemButton
              label="New action" icon={FaPlus}
              onClick={() => WebSocketManagerInstance.Send({
                command: "action_add",
                data: { prefix: "MyPrefix", name: "Name", hook: 0, content: "[]" },
              })}
            />
          </HStack>

          {/* Search */}
          <Box px={2} pt={2} pb={1} flexShrink={0}>
            <SearchInput value={search} onChange={setSearch} />
          </Box>

          {/* Tree */}
          <Box flex={1} overflowY="auto" px={1} pb={2}>
            {loading ? (
              <Flex align="center" justify="center" gap={2} py={6} color="gray.600">
                <Spinner size="sm" /> <Text fontSize="sm">Loading…</Text>
              </Flex>
            ) : treeData.length === 0 ? (
              <Text fontSize="sm" color="gray.600" textAlign="center" py={6} fontStyle="italic">
                No actions found
              </Text>
            ) : (
              <ReactTreeList
                onChange={setTreeData}
                onSelected={({ id, isGroup, label }) => selectItem({ id, isGroup, label })}
                data={treeData}
                draggable={false}
                itemDefaults={{ open: false, arrow: "▸" }}
              />
            )}          </Box>
        </Flex>

        <ResizeDivider onMouseDown={(e) => onDividerMouseDown(0, e)} />

        {/* ── right pane ── */}
        {selection?.type === "group" && (
          <GroupPane group={selection.label} actions={actions} />
        )}
        {selection?.type === "action" && selectedAction && (
          <ActionPane
            selectedAction={selectedAction}
            setSelectedAction={setSelectedAction}
            steps={steps}
            stepsRef={stepsRef}
            setSteps={setSteps}
            stepDefinitions={stepDefinitions}
            hooksCollection={hooksCollection}
          />
        )}
        {!selection && <EmptyPane />}
      </Flex>
    </>
  );
};

export default ActionsPanel;
