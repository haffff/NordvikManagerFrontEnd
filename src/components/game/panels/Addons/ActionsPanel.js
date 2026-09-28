import * as React from "react";
import { Badge, Box, Button, Flex, HStack, Input, Spinner, Text } from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import { FaBolt, FaChevronDown, FaChevronRight, FaPlay, FaPlus, FaSearch } from "react-icons/fa";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../helpers/transport";
import { ActiveWebHelper as WebHelper } from "../../../../helpers/transport";
import ClientMediator from "../../../../ClientMediator";
import CollectionSyncer from "../../../uiComponents/base/CollectionSyncer";
import { SearchInput } from "../../../uiComponents/SearchInput";
import DListItemButton from "../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import { ResizeDivider, useDragResize } from "../../../uiComponents/ResizeDivider";
import { DialogRoot, DialogContent, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "../../../ui/dialog";
import { ActionEditor, fullActionName } from "./ActionEditor/ActionEditor";
import { useActionDraft } from "./ActionEditor/useActionDraft";
import { T } from "./ActionEditor/editorTheme";
import { QueryResolver } from "./ActionEditor/QueryResolver";

// Actions panel: the list of actions (grouped by prefix) on the left, the editor on the right.
// Unsaved edits are protected: switching action asks first, and if the panel closes or the
// page reloads with unsaved edits, the draft is kept and offered back next time.

// ─── unsaved-draft storage ────────────────────────────────────────────────────
const DRAFT_KEY = (id) => `nm.actionEditor.draft.${id}`;
const storeDraft = (payload) => {
  try { localStorage.setItem(DRAFT_KEY(payload.id), JSON.stringify({ at: Date.now(), payload })); } catch { /* optional */ }
};
const readDraft = (id) => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY(id)) ?? "null"); } catch { return null; }
};
const dropDraft = (id) => { try { localStorage.removeItem(DRAFT_KEY(id)); } catch { /* optional */ } };

// ─── sidebar ──────────────────────────────────────────────────────────────────
const ActionRow = ({ action, hookName, selected, onClick }) => (
  <HStack
    px={2} py="3px" gap={2} borderRadius="sm" cursor="pointer" onClick={onClick}
    bg={selected ? T.selected : undefined} _hover={{ bg: selected ? T.selected : T.hover }}
  >
    <Box w="6px" h="6px" borderRadius="full" flexShrink={0}
      bg={action.isEnabled ? "green.400" : "gray.600"} title={action.isEnabled ? "Enabled" : "Disabled"} />
    <Text fontSize="sm" color={selected ? "white" : "gray.300"} flex={1} truncate>{action.name || "Unnamed"}</Text>
    {hookName && <Box color="purple.300" title={`Trigger: ${hookName}`} flexShrink={0}><FaBolt size={9} /></Box>}
  </HStack>
);

const NewActionForm = ({ onCreate, onCancel }) => {
  const [prefix, setPrefix] = React.useState("");
  const [name, setName] = React.useState("");
  const submit = () => { if (name.trim()) onCreate(prefix.trim(), name.trim()); };
  return (
    <Box p={2} borderBottomWidth="1px" borderColor={T.border} bg={T.raised}>
      <HStack gap={1}>
        <Input size="xs" w="40%" placeholder="prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
        <Input size="xs" autoFocus placeholder="action name" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }} />
      </HStack>
      <HStack mt={1} justify="flex-end" gap={1}>
        <Button size="2xs" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="2xs" colorPalette="blue" variant="outline" onClick={submit} disabled={!name.trim()}>Create</Button>
      </HStack>
    </Box>
  );
};

const Sidebar = ({ actions, hooks, loading, selectedId, onSelect, onSelectGroup, onCreate }) => {
  const [search, setSearch] = React.useState("");
  const [closed, setClosed] = React.useState({});
  const [creating, setCreating] = React.useState(false);
  const hookName = (h) => hooks.find((x) => Number(x.value) === Number(h))?.name;

  const groups = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = actions.filter((a) => !q || fullActionName(a).toLowerCase().includes(q));
    const map = {};
    filtered.forEach((a) => { (map[a.prefix || "(no prefix)"] ??= []).push(a); });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([prefix, list]) => [prefix, [...list].sort((x, y) => (x.name ?? "").localeCompare(y.name ?? ""))]);
  }, [actions, search]);

  return (
    <Flex direction="column" h="100%" bg={T.surface} overflow="hidden">
      <HStack px={3} py={2} gap={2} flexShrink={0} borderBottomWidth="1px" borderColor={T.border}>
        <Text fontSize="xs" fontWeight="semibold" color="gray.400" textTransform="uppercase" letterSpacing="wider" flex={1}>Actions</Text>
        {!loading && <Badge variant="subtle" colorPalette="gray" fontSize="2xs">{actions.length}</Badge>}
        <DListItemButton label="New action" icon={FaPlus} onClick={() => setCreating(true)} />
      </HStack>
      {creating && (
        <NewActionForm onCancel={() => setCreating(false)} onCreate={(p, n) => { onCreate(p, n); setCreating(false); }} />
      )}
      <Box px={2} pt={2} pb={1} flexShrink={0}><SearchInput value={search} onChange={setSearch} /></Box>
      <Box flex={1} overflowY="auto" px={1} pb={2}>
        {loading ? (
          <Flex align="center" justify="center" gap={2} py={6} color="gray.600"><Spinner size="sm" /> <Text fontSize="sm">Loading…</Text></Flex>
        ) : groups.length === 0 ? (
          <Text fontSize="sm" color="gray.600" textAlign="center" py={6} fontStyle="italic">No actions found</Text>
        ) : groups.map(([prefix, list]) => {
          const isClosed = closed[prefix] && !search;
          return (
            <Box key={prefix} mb={1}>
              <HStack px={1} py="3px" gap={1} cursor="pointer" color="gray.400" _hover={{ color: "white" }}>
                <Box onClick={() => setClosed((c) => ({ ...c, [prefix]: !c[prefix] }))} p="2px">
                  {isClosed ? <FaChevronRight size={9} /> : <FaChevronDown size={9} />}
                </Box>
                <Text fontSize="xs" fontWeight="semibold" flex={1} truncate onClick={() => onSelectGroup(prefix)}>{prefix}</Text>
                <Text fontSize="2xs" color={T.faint}>{list.length}</Text>
              </HStack>
              {!isClosed && list.map((a) => (
                <Box key={a.id} pl={3}>
                  <ActionRow action={a} hookName={hookName(a.hook)} selected={a.id === selectedId} onClick={() => onSelect(a.id)} />
                </Box>
              ))}
            </Box>
          );
        })}
      </Box>
      <QueryResolver />
    </Flex>
  );
};

// ─── group pane: the group's actions + "Run all" ─────────────────────────────
const GroupPane = ({ group, actions, onSelect }) => {
  const [confirmRun, setConfirmRun] = React.useState(false);
  const list = actions.filter((a) => (a.prefix || "(no prefix)") === group);
  const runAll = () => {
    list.forEach((a) => ClientMediator.sendCommand("Action", "Run", { name: fullActionName(a) }));
    setConfirmRun(false);
  };
  return (
    <Flex direction="column" flex={1} p={5} gap={3} overflowY="auto">
      <Box>
        <Text fontSize="lg" color="white" fontWeight="semibold">{group}</Text>
        <Text fontSize="sm" color="gray.400">{list.length} action{list.length !== 1 ? "s" : ""}</Text>
      </Box>
      <Flex direction="column" gap={1}>
        {list.map((a) => (
          <HStack key={a.id} px={3} py={2} bg={T.raised} borderRadius="md" borderWidth="1px" borderColor={T.border}
            cursor="pointer" _hover={{ borderColor: "gray.500" }} onClick={() => onSelect(a.id)}>
            <Badge size="sm" colorPalette={a.isEnabled ? "green" : "gray"} variant="subtle">{a.isEnabled ? "On" : "Off"}</Badge>
            <Text fontSize="sm" flex={1} color="white">{a.name}</Text>
          </HStack>
        ))}
      </Flex>
      <Box>
        {confirmRun ? (
          <HStack gap={2}>
            <Text fontSize="sm" color="orange.300">Run all {list.length} actions?</Text>
            <Button size="sm" colorPalette="orange" variant="outline" onClick={runAll}>Confirm</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmRun(false)}>Cancel</Button>
          </HStack>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setConfirmRun(true)}><FaPlay /> Run all</Button>
        )}
      </Box>
    </Flex>
  );
};

// ─── main component ──────────────────────────────────────────────────────────
export const ActionsPanel = () => {
  const [actions, setActions] = React.useState([]);
  const [hooks, setHooks] = React.useState([]);
  const [stepDefinitions, setStepDefinitions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [group, setGroup] = React.useState(null);
  const [pending, setPending] = React.useState(null);       // navigation waiting on the unsaved-changes dialog
  const [restorable, setRestorable] = React.useState(null);  // a kept draft for the opened action
  const draft = useActionDraft();
  const draftRef = React.useRef(draft);
  draftRef.current = draft;
  const createdRef = React.useRef(null); // "prefix/name" just created here, to open it when it arrives

  const colRef = React.useRef(null);
  const { fracs, onDividerMouseDown } = useDragResize(colRef, [0.26]);

  const ctx = Dockable.useContentContext();
  ctx.setTitle("Actions");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, defs, hookList] = await Promise.all([
          WebHelper.getAsync("addon/actions"),
          WebHelper.getAsync("addon/stepdefinitions"),
          WebHelper.getAsync("addon/hooks"),
        ]);
        if (cancelled) return;
        setActions(Array.isArray(list) ? list : []);
        setStepDefinitions(Array.isArray(defs?.stepDefinitions) ? defs.stepDefinitions : []);
        setHooks(Array.isArray(hookList) ? hookList : []);
      } catch (err) {
        console.warn("[ActionsPanel] load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Keep unsaved edits if the panel closes or the page unloads.
  React.useEffect(() => {
    const keep = () => { const d = draftRef.current; if (d.dirty && d.action?.id) storeDraft(d.payload()); };
    window.addEventListener("beforeunload", keep);
    return () => { window.removeEventListener("beforeunload", keep); keep(); };
  }, []);

  const openAction = async (id) => {
    try {
      const response = await WebHelper.getAsync("addon/action?id=" + id);
      if (!response) return;
      setGroup(null);
      draft.load(response);
      const stored = readDraft(id);
      setRestorable(stored && stored.payload?.content !== response.content ? stored : null);
    } catch (err) {
      console.warn("[ActionsPanel] failed to load action:", err);
    }
  };

  const go = (target) => {
    if (target.type === "action") openAction(target.id);
    else { draft.load(null); setRestorable(null); setGroup(target.prefix); }
  };

  // Every navigation goes through here so unsaved edits are never dropped silently.
  const navigate = (target) => {
    if (target.type === "action" && target.id === draft.action?.id) return;
    if (draft.dirty) { setPending(target); return; }
    go(target);
  };

  const save = (payload) => {
    WebSocketManagerInstance.Send({ command: "action_update", data: payload });
    setActions((list) => list.map((a) => (a.id === payload.id ? { ...a, ...payload } : a)));
    dropDraft(payload.id);
    setRestorable(null);
  };

  const restore = () => {
    const { payload } = restorable;
    const { content, ...fields } = payload;
    draft.updateAction(fields);
    let steps = [];
    try { steps = JSON.parse(content ?? "[]"); } catch { /* keep empty */ }
    draft.setSteps(() => steps);
    setRestorable(null); // stays "unsaved" until the user saves
  };

  const openByName = (name) => {
    const target = actions.find((a) => fullActionName(a) === name) ?? actions.find((a) => a.name === name);
    if (target) navigate({ type: "action", id: target.id });
  };

  const create = (prefix, name) => {
    createdRef.current = prefix ? `${prefix}/${name}` : name;
    WebSocketManagerInstance.Send({ command: "action_add", data: { prefix, name, hook: 0, content: "[]" } });
  };

  const remove = () => {
    WebSocketManagerInstance.Send({ command: "action_delete", data: draft.action.id });
    dropDraft(draft.action.id);
    draft.load(null);
  };

  return (
    <>
      <CollectionSyncer
        commandPrefix="action" collection={actions} setCollection={setActions}
        onAdd={(a) => {
          if (a?.id && fullActionName(a) === createdRef.current) { createdRef.current = null; navigate({ type: "action", id: a.id }); }
        }}
      />
      <Flex height="100%" overflow="hidden" ref={colRef}>
        <Box width={`${fracs[0] * 100}%`} flexShrink={0} overflow="hidden">
          <Sidebar actions={actions} hooks={hooks} loading={loading} selectedId={draft.action?.id}
            onSelect={(id) => navigate({ type: "action", id })}
            onSelectGroup={(prefix) => navigate({ type: "group", prefix })}
            onCreate={create} />
        </Box>
        <ResizeDivider onMouseDown={(e) => onDividerMouseDown(0, e)} />
        <Flex flex={1} direction="column" overflow="hidden" minW={0}>
          {restorable && draft.action && (
            <HStack px={3} py={2} gap={2} bg="rgba(236,201,75,0.12)" borderBottomWidth="1px" borderColor="yellow.700" flexShrink={0}>
              <Text fontSize="xs" color="yellow.200" flex={1}>
                Unsaved changes to this action were kept from {new Date(restorable.at).toLocaleString()}.
              </Text>
              <Button size="2xs" variant="outline" onClick={restore}>Restore</Button>
              <Button size="2xs" variant="ghost" onClick={() => { dropDraft(draft.action.id); setRestorable(null); }}>Discard</Button>
            </HStack>
          )}
          {draft.action ? (
            <ActionEditor draft={draft} stepDefinitions={stepDefinitions} hooks={hooks} actions={actions}
              onSave={save} onDelete={remove} onOpenAction={openByName} />
          ) : group ? (
            <GroupPane group={group} actions={actions} onSelect={(id) => navigate({ type: "action", id })} />
          ) : (
            <Flex flex={1} direction="column" align="center" justify="center" gap={3} color="gray.600">
              <FaSearch size={24} opacity={0.3} />
              <Text fontSize="sm">Select an action, or create one with +</Text>
            </Flex>
          )}
        </Flex>
      </Flex>

      <DialogRoot open={!!pending} size="sm" onOpenChange={(e) => { if (!e.open) setPending(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Unsaved changes</DialogTitle></DialogHeader>
          <DialogBody>
            <Text fontSize="sm">“{fullActionName(draft.action)}” has changes that aren't saved yet.</Text>
          </DialogBody>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
            <Button size="sm" variant="outline" colorPalette="red" onClick={() => { const t = pending; setPending(null); go(t); }}>Discard</Button>
            <Button size="sm" colorPalette="blue" onClick={() => { save(draft.payload()); draft.markSaved(); const t = pending; setPending(null); go(t); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </>
  );
};

export default ActionsPanel;
