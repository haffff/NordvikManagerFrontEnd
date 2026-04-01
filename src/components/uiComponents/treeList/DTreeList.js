import { Box, Flex, HStack, Icon, IconButton, Spinner, Text } from '@chakra-ui/react';
import * as React from 'react';
import Subscribable from '../base/Subscribable';
import { ReactTreeList } from '@bartaxyz/react-tree-list';
import WebSocketManagerInstance from '../../game/WebSocketManager';
import InputModal from '../base/Modals/InputModal';
import { ActiveWebHelper as WebHelper } from '../../../helpers/transport';
import { FaEdit, FaFolder, FaMinusCircle, FaPlus, FaSync } from 'react-icons/fa';
import DListItemButton from '../base/List/ListItemDetails/DListItemButton';
import DListItem from '../base/List/DListItem';
import DynamicIcon from '../icons/DynamicIcon';
import UtilityHelper from '../../../helpers/UtilityHelper';
import { SearchInput } from '../SearchInput';

// ─── module-level constants ───────────────────────────────────────────────────

const FOLDER_CONFIG = [
    { key: "name",  label: "Folder Name", toolTip: "Name of folder.", type: "string"    },
    { key: "color", label: "Color",       toolTip: "Color of folder.", type: "color"     },
    { key: "icon",  label: "Icon",        toolTip: "Icon of folder.",  type: "iconSelect" },
];

// ─── pure helpers (no React) ──────────────────────────────────────────────────

/**
 * Build an O(n) id→item Map and resolve _next / _parent back-references.
 * Returns { byId, childrenOf, roots } where:
 *   - byId      : Map<id, item>
 *   - childrenOf: Map<parentId, item[]>  — pre-grouped for O(1) child lookup
 *   - roots     : item[]                 — chain heads with no parent / not pointed-as-next
 */
function buildIndex(treeItems) {
    const byId = new Map();
    for (const item of treeItems) byId.set(item.id, { ...item, _next: null, _parent: null });

    for (const item of byId.values()) {
        if (item.next)     item._next   = byId.get(item.next)     ?? null;
        if (item.parentId) item._parent = byId.get(item.parentId) ?? null;
    }

    // Pre-group children by parentId so headChildOf() is O(1) instead of O(n).
    const childrenOf = new Map();
    for (const item of byId.values()) {
        if (!item._parent) continue;
        const pid = item._parent.id;
        if (!childrenOf.has(pid)) childrenOf.set(pid, []);
        childrenOf.get(pid).push(item);
    }

    const pointedAsNext = new Set();
    for (const item of byId.values()) if (item.next) pointedAsNext.add(item.next);

    const roots = [...byId.values()].filter(x => !x._parent && !pointedAsNext.has(x.id));
    return { byId, childrenOf, roots };
}

/** Walk a linked-list chain (via _next), returning items in order. */
function walkChain(first) {
    const out = [];
    const seen = new Set();
    let cur = first;
    while (cur && !seen.has(cur.id)) { seen.add(cur.id); out.push(cur); cur = cur._next; }
    return out;
}

/** Build a breadcrumb path string for an item using its _parent chain. */
function buildPath(item) {
    let path = "";
    let p = item._parent;
    while (p) { path = p.name + "/" + path; p = p._parent; }
    return path;
}

// ─── sub-components ───────────────────────────────────────────────────────────

const FolderLabel = React.memo(({ id, name, icon, color, treeId }) => (
    <DListItem id={`${treeId}/f-${id}`}>
        <Flex align="center" gap="8px" width="100%" px="4px">
            {color && (
                <Box
                    width="8px" height="8px" borderRadius="full" flexShrink={0}
                    style={{ backgroundColor: color }}
                />
            )}
            {icon ? <DynamicIcon iconName={icon} /> : <Icon as={FaFolder} opacity={0.6} />}
            <Text fontSize="sm" flex={1} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                {name}
            </Text>
        </Flex>
    </DListItem>
));

const EmptyState = () => (
    <Flex direction="column" align="center" justify="center" gap="8px" py="32px"
        color="gray.500" userSelect="none">
        <Icon as={FaFolder} boxSize={8} opacity={0.25} />
        <Text fontSize="sm">No items</Text>
    </Flex>
);

/** Toolbar — memoised so it never re-renders during tree redraws. */
const Toolbar = React.memo(({
    withAddItem, selectedItem, items,
    onAddItem, onCreateFolder, onEditFolder, onDeleteFolder,
    onGenerateEditButtons, onRefresh, refreshing,
}) => {
    const isFolder     = Boolean(selectedItem?.isFolder);
    const targetEntity = !isFolder && selectedItem
        ? items?.find(x => x.id === selectedItem.targetId)
        : null;

    return (
        <HStack gap="2px" px="4px" py="4px" flexWrap="wrap" flexShrink={0}
            borderBottomWidth="1px" borderColor="rgb(60,60,60)">
            {withAddItem && (
                <DListItemButton label="Add Item" icon={FaPlus}
                    onClick={() => onAddItem?.(selectedItem)} />
            )}
            <DListItemButton label="Add Folder" icon={FaFolder} onClick={onCreateFolder} />
            {isFolder && <>
                <DListItemButton label="Edit Folder"   icon={FaEdit}       onClick={onEditFolder}   />
                <DListItemButton label="Delete Folder" icon={FaMinusCircle} color="red" onClick={onDeleteFolder} />
            </>}
            {!isFolder && targetEntity && onGenerateEditButtons?.(targetEntity)}
            {onRefresh && (
                <IconButton
                    aria-label="Refresh"
                    title="Refresh"
                    size="xs"
                    variant="ghost"
                    ml="auto"
                    onClick={onRefresh}
                    disabled={refreshing}
                >
                    <Icon as={FaSync} boxSize="11px" style={refreshing ? { animation: "spin 0.8s linear infinite" } : undefined} />
                </IconButton>
            )}
        </HStack>
    );
});

// ─── main component ───────────────────────────────────────────────────────────

export const DTreeList = ({
    withAddItem,
    selectedItemOverwrite,
    onAddItem,
    items,
    generateItem,
    entityType,
    onFolderDelete,
    onGenerateEditButtons,
    onSelect,
    refreshRef,
    onRefresh,
}) => {
    const _generateItem = React.useMemo(
        () => generateItem ?? ((x) => x?.name ?? ""),
        [generateItem]
    );

    // ── state ──────────────────────────────────────────────────────────────────
    const [treeItems,  setTreeItems]  = React.useState([]);
    const [treeData,   setTreeData]   = React.useState([]);
    const [selected,   setSelected]   = React.useState(null);
    const [filter,     setFilter]     = React.useState("");
    const [loading,    setLoading]    = React.useState(false);

    // ── stable refs ────────────────────────────────────────────────────────────
    const treeId        = React.useRef(UtilityHelper.GenerateUUID()).current;
    const itemsRef      = React.useRef(items ?? []);
    const treeItemsRef  = React.useRef([]);
    const treeDataRef   = React.useRef([]);
    const filterRef     = React.useRef(filter);
    const indexRef      = React.useRef({ byId: new Map(), roots: [] });
    const selectedRef   = React.useRef(selected);
    const entityTypeRef = React.useRef(entityType);

    itemsRef.current     = items ?? [];
    treeItemsRef.current = treeItems;
    treeDataRef.current  = treeData;
    filterRef.current    = filter;
    selectedRef.current  = selected;
    entityTypeRef.current = entityType;

    // modal open-fn refs
    const openCreateRef = React.useRef();
    const openEditRef   = React.useRef();

    // ── open-state preservation ────────────────────────────────────────────────
    const collectOpenStates = React.useCallback(() => {
        const map = new Map();
        const walk = (nodes) => {
            for (const n of nodes) {
                if (n.open) map.set(n.id, true);
                if (n.children?.length) walk(n.children);
            }
        };        walk(treeDataRef.current);
        return map;
    }, []);

    // ── tree rendering ─────────────────────────────────────────────────────────
    const renderTree = React.useCallback((rawTree, rawItems) => {
        if (!rawTree?.length) { setTreeData([]); return; }

        const { byId, childrenOf, roots } = buildIndex(rawTree);
        indexRef.current = { byId, roots };

        const openStates  = collectOpenStates();
        const lowerFilter = filterRef.current.toLowerCase();

        // O(1) lookup: find the head of the child-chain for a given parent id.
        const headChildOf = (parentId) => {
            const children = childrenOf.get(parentId);
            if (!children?.length) return null;
            const pointedAsNext = new Set(children.map(x => x.next).filter(Boolean));
            return children.find(x => !pointedAsNext.has(x.id)) ?? null;
        };

        const buildNodes = (firstItem) => {
            const nodes = [];
            for (const item of walkChain(firstItem)) {
                const childHead  = headChildOf(item.id);
                const childNodes = childHead ? buildNodes(childHead) : [];

                if (item.isFolder) {
                    nodes.push({
                        ...item,
                        icon: undefined, itemIcon: item.icon,
                        children: childNodes,
                        open: openStates.get(item.id) ?? false,
                        label: (
                            <FolderLabel
                                id={item.id} name={item.name}
                                icon={item.icon} color={item.color}
                                treeId={treeId}
                            />
                        ),
                    });
                } else {
                    const entity = rawItems.find(x => x.id === item.targetId);
                    if (!entity) continue;
                    if (lowerFilter && !entity.name?.toLowerCase().includes(lowerFilter)) continue;

                    nodes.push({
                        ...item,
                        icon: undefined, itemIcon: item.icon,
                        children: childNodes,
                        open: openStates.get(item.id) ?? false,
                        itemRef: entity,
                        label: (
                            <>
                                <div className="representsElement"
                                    id={`${treeId}/${entity.id}`}
                                    style={{ display: "none" }} />
                                {_generateItem(entity, item)}
                            </>
                        ),
                    });
                }
            }
            return nodes;
        };

        const data = [];
        for (const root of roots) data.push(...buildNodes(root));
        setTreeData(data);
    }, [_generateItem, treeId, collectOpenStates]);    // ── selectedItemOverwrite — let parent drive selection ─────────────────────
    React.useEffect(() => {
        if (selectedItemOverwrite === undefined) return;
        setSelected(selectedItemOverwrite ?? null);
    }, [selectedItemOverwrite]);

    // ── initial load ───────────────────────────────────────────────────────────
    const fetchTree = React.useCallback(() => {
        if (!entityTypeRef.current) return;
        setLoading(true);
        WebHelper.get(
            `battlemap/getTree?entityType=${entityTypeRef.current}`,
            (response) => {
                setLoading(false);
                setTreeItems(response);
                renderTree(response, itemsRef.current);
            },
            () => setLoading(false),
        );
    // renderTree is stable (useCallback with no changing deps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [renderTree]);

    React.useEffect(() => {
        if (refreshRef) refreshRef.current = fetchTree;
    }, [refreshRef, fetchTree]);

    React.useEffect(() => {
        if (!entityType) return;
        fetchTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entityType]);

    // Re-render when items list reference changes (entities loaded/updated by parent)
    const prevItemsRef = React.useRef(null);
    React.useEffect(() => {
        if (prevItemsRef.current === items) return;
        prevItemsRef.current = items;
        renderTree(treeItemsRef.current, items ?? []);
    }, [items, renderTree]);

    // Re-render on filter change — only if tree data already exists
    React.useEffect(() => {
        if (!treeItemsRef.current.length) return;
        renderTree(treeItemsRef.current, itemsRef.current);    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]);

    // ── drag & drop ────────────────────────────────────────────────────────────
    // Attach a SINGLE delegated listener once on mount — entityType read from ref.
    React.useEffect(() => {
        const container = document.getElementById(treeId);
        if (!container) return;
        const handler = (e) => {
            const id = e.target
                ?.closest(".representsElement")
                ?.id?.split("/")?.[1]
                ?? e.target?.querySelector(".representsElement")
                    ?.id?.split("/")?.[1];
            if (!id || id.startsWith("f-")) return;
            sessionStorage.setItem("draggable", JSON.stringify({ entityType: entityTypeRef.current, id }));
        };
        container.addEventListener("dragstart", handler);
        return () => container.removeEventListener("dragstart", handler);
    // treeId is stable (UUID generated once); container only mounts once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [treeId]);

    const onDrop = React.useCallback((draggingNode, dragNode, dragType) => {
        const parentId = dragNode._parent?.id ?? null;
        switch (dragType) {
            case "inner":
                if (!dragNode.isFolder) { renderTree(treeItemsRef.current, itemsRef.current); return; }
                WebSocketManagerInstance.Send({ command: "tree_update",
                    data: { id: draggingNode.id, parentId: dragNode.id, next: null } });
                break;
            case "after":
                if (dragNode?._next?.id === draggingNode.id) {
                    renderTree(treeItemsRef.current, itemsRef.current); return;
                }
                WebSocketManagerInstance.Send({ command: "tree_update",
                    data: { id: draggingNode.id, parentId, next: dragNode?._next?.id ?? null } });
                break;
            case "before":
                WebSocketManagerInstance.Send({ command: "tree_update",
                    data: { id: draggingNode.id, parentId, next: dragNode.id } });
                break;
            default: break;
        }
    }, [renderTree]);

    // ── WS handler ─────────────────────────────────────────────────────────────
    // renderTree must NOT be called inside a setState updater (React anti-pattern).
    // Instead we store the updated list in a ref and trigger a re-render via a
    // dedicated counter; a useEffect watches that counter and calls renderTree.
    const pendingTreeRef  = React.useRef(null);
    const [renderTick, setRenderTick] = React.useState(0);

    React.useEffect(() => {
        if (pendingTreeRef.current === null) return;
        renderTree(pendingTreeRef.current, itemsRef.current);
        pendingTreeRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [renderTick]);

    const handleMessage = React.useCallback((response) => {
        const { command, data } = response;

        if (command === "tree_add" || command === "tree_update") {
            const incoming = Array.isArray(data) ? data : [data];
            // Ignore messages for a different entity type
            if (incoming.some(x => x && x.entryType && x.entryType !== entityTypeRef.current)) return;

            // Check synchronously (via ref) if any incoming item is a brand-new node
            // that the server created without autoConnect — those can't be directly inserted
            // because their position in the linked list is server-determined. A full tree
            // refetch is the only reliable way to get them.
            const currentTree = treeItemsRef.current;
            const needsFullRefresh = command === "tree_add" && incoming.some(
                el => el && !el.autoConnect && !currentTree.find(x => x.id === el.id)
            );

            setTreeItems(prev => {
                const next = [...prev];
                for (const el of incoming) {
                    if (!el) continue;
                    const idx = next.findIndex(x => x.id === el.id);
                    if (idx !== -1) next[idx] = el;
                    else if (el.autoConnect) next.push(el);
                }
                pendingTreeRef.current = next;
                setRenderTick(t => t + 1);
                return next;
            });

            if (needsFullRefresh) fetchTree();
            return;
        }

        if (command === "tree_remove") {
            setTreeItems(prev => {
                const next = prev.filter(x => x.id !== data);
                pendingTreeRef.current = next;                setRenderTick(t => t + 1);
                return next;
            });
            // Clear selection if the removed item was selected
            setSelected(sel => sel?.id === data ? null : sel);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchTree]);

    // ── folder operations ──────────────────────────────────────────────────────
    const handleCreateFolder = React.useCallback(({ name, parent, color, icon }) => {
        WebSocketManagerInstance.Send({
            command: "tree_add",
            data: { name, color, icon, entryType: entityType,
                    next: parent ?? null, parentId: null, isFolder: true, autoConnect: true },
        });
    }, [entityType]);

    const handleDeleteFolder = React.useCallback(() => {
        if (!selectedRef.current?.id) return;
        WebSocketManagerInstance.Send({ command: "tree_remove", data: selectedRef.current.id });
        onFolderDelete?.(selectedRef.current.id);
    }, [onFolderDelete]);

    // Build path-prefixed labels for the "add after" dropdown in the create modal
    const getFolderOptions = () =>
        treeItemsRef.current.map(x => {
            const indexed = indexRef.current.byId.get(x.id);
            const path = indexed ? buildPath(indexed) : "";
            const name = x.isFolder
                ? x.name
                : (itemsRef.current.find(e => e.id === x.targetId)?.name ?? "");
            return { value: x.id, label: path + name };
        });

    // ── selection ──────────────────────────────────────────────────────────────
    const handleSelect = React.useCallback((node) => {
        setSelected(node);
        onSelect?.(node);
    }, [onSelect]);

    // ── render ─────────────────────────────────────────────────────────────────
    return (
        <Flex direction="column" height="100%" overflow="hidden" gap={0}>
            <Subscribable commandPrefix="tree_" onMessage={handleMessage} />

            {/* Create folder */}
            <InputModal
                title="Create new folder"
                getConfigDict={() => [
                    ...FOLDER_CONFIG,
                    { key: "parent", label: "Add after", toolTip: "Position in list.",
                      type: "select", options: getFolderOptions() },
                ]}
                openRef={openCreateRef}
                onCloseModal={(data, success) => { if (success) handleCreateFolder(data); }}
            />

            {/* Edit / rename folder */}
            <InputModal
                title="Edit folder"
                getConfigDict={() => FOLDER_CONFIG}
                openRef={openEditRef}
                onCloseModal={({ name, color, icon }, success) => {
                    if (success && selectedRef.current) {
                        WebSocketManagerInstance.Send({
                            command: "tree_update",
                            data: { id: selectedRef.current.id, name, color, icon },
                        });
                    }
                }}
            />

            {/* Toolbar */}
            <Toolbar
                withAddItem={withAddItem}
                selectedItem={selected}
                items={items}
                onAddItem={onAddItem}
                onCreateFolder={() => openCreateRef.current?.({ name: "", parent: selected?.id })}
                onEditFolder={() => openEditRef.current?.({ ...selected, icon: selected?.itemIcon })}
                onDeleteFolder={handleDeleteFolder}
                onGenerateEditButtons={onGenerateEditButtons}
                onRefresh={onRefresh ? () => { fetchTree(); onRefresh(); } : undefined}
                refreshing={loading}
            />

            {/* Search */}
            <Box px="4px" py="4px" flexShrink={0}>
                <SearchInput value={filter} onChange={v => setFilter(v)} />
            </Box>

            {/* Tree body */}
            <Box flex={1} overflowY="auto">
                {loading ? (
                    <Flex align="center" justify="center" gap="8px" py="24px" color="gray.500">
                        <Spinner size="sm" />
                        <Text fontSize="sm">Loading…</Text>
                    </Flex>
                ) : treeData.length === 0 ? (
                    <EmptyState />
                ) : (
                    <Box id={treeId}>
                        <ReactTreeList
                            itemDefaults={{ arrow: "▸" }}
                            data={treeData}
                            onSelected={handleSelect}
                            onChange={setTreeData}
                            onDrop={onDrop}
                        />
                    </Box>
                )}
            </Box>
        </Flex>
    );
};

export default DTreeList;