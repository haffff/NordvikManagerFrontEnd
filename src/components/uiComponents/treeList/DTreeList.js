import { Box, Button, Flex, HStack, Icon, IconButton, Spinner, Text } from '@chakra-ui/react';
import * as React from 'react';
import Subscribable from '../base/Subscribable';
import { ReactTreeList } from '@bartaxyz/react-tree-list';
import { ActiveTransportManager as WebSocketManagerInstance } from '../../../helpers/transport';
import InputModal from '../base/Modals/InputModal';
import { ActiveWebHelper as WebHelper } from '../../../helpers/transport';
import { FaEdit, FaFolder, FaMinusCircle, FaPlus, FaSync, FaTrashAlt } from 'react-icons/fa';
import {
    DialogRoot, DialogContent, DialogHeader, DialogTitle,
    DialogBody, DialogFooter,
} from '../../ui/dialog';
import DListItemButton from '../base/List/ListItemDetails/DListItemButton';
import DListItem from '../base/List/DListItem';
import DynamicIcon from '../icons/DynamicIcon';
import UtilityHelper from '../../../helpers/UtilityHelper';
import { SearchInput } from '../SearchInput';
import { MenuContent, MenuContextTrigger, MenuRoot } from '../../ui/menu';
import DropDownItem from '../base/DDItems/DropDownItem';

// ─── module-level constants ───────────────────────────────────────────────────

const FOLDER_CONFIG = [
    { key: "name",  label: "Folder Name", toolTip: "Name of folder.", type: "string"    },
    { key: "color", label: "Color",       toolTip: "Color of folder.", type: "color"     },
    { key: "icon",  label: "Icon",        toolTip: "Icon of folder.",  type: "iconSelect" },
];

// The underlying tree list has no virtualization — an expanded folder mounts a
// real row (and, for e.g. images, a preview fetch) for every single child at
// once. A folder with hundreds of items would mount hundreds of rows/previews
// simultaneously, so each parent's children are capped and revealed in batches.
const DEFAULT_VISIBLE_ITEMS = 50;
const REVEAL_STEP = 50;
const ROOT_KEY = "__root__";

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

/**
 * Collect all descendants of a folder in safe deletion order:
 * leaf items first, then their parent sub-folders (depth-first post-order).
 * The root folder itself is NOT included — caller handles it separately.
 */
function collectDescendants(folderId, treeItems) {
    // Build a parentId→children map once (O(n)) to avoid O(n²) repeated filtering
    const childrenOf = new Map();
    for (const item of treeItems) {
        if (!item.parentId) continue;
        if (!childrenOf.has(item.parentId)) childrenOf.set(item.parentId, []);
        childrenOf.get(item.parentId).push(item);
    }

    const result = [];
    const recurse = (parentId) => {
        for (const child of childrenOf.get(parentId) ?? []) {
            if (child.isFolder) {
                recurse(child.id);
                result.push(child);
            } else {
                result.push(child);
            }
        }
    };
    recurse(folderId);
    return result;
}

// ─── sub-components ───────────────────────────────────────────────────────────

const FolderLabel = React.memo(({ id, name, icon, color, treeId, node, actions }) => {
    const content = (
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
    );

    // Right-click gives access to the same folder actions as the top toolbar —
    // gated by the same canEditFolders permission the toolbar uses.
    if (!actions?.canEditFolders()) return content;

    return (
        <MenuRoot onOpenChange={(d) => { if (d.open) actions.onSelect(node); }}>
            <MenuContextTrigger>{content}</MenuContextTrigger>
            <MenuContent>
                <DropDownItem name="Edit Folder" icon={FaEdit} onClick={() => actions.onEditFolder(node)} />
                <DropDownItem name="Delete Folder" icon={FaMinusCircle} onClick={() => actions.onDeleteFolder(node)} />
                <DropDownItem name="Delete All" icon={FaTrashAlt} onClick={() => actions.onDeleteAllFolder(node)} />
            </MenuContent>
        </MenuRoot>
    );
});

// onGenerateEditButtons hands back toolbar buttons (<DListItemButton icon label
// onClick />, wrapped in a top-level <>...</> fragment plus conditionals) —
// reused here as plain data (icon + label + onClick), not rendered as-is, so
// the context menu reads like a normal menu (icon on the left, name of action)
// instead of a strip of icon buttons. Every current caller (CardsPanel,
// MaterialsPanel) already follows this label/icon/onClick shape.
//
// React.Children.toArray does NOT unwrap a *top-level* Fragment — it treats it
// as one opaque element — so a caller's `<>{a}{b}</>` return value comes back
// as a single item with no icon/label/onClick of its own. Recurse through
// fragments (and arrays, from conditionals like {cond && <A/>}) ourselves.
const flattenButtons = (node) => {
    if (node == null || typeof node === "boolean") return [];
    if (Array.isArray(node)) return node.flatMap(flattenButtons);
    if (React.isValidElement(node)) {
        return node.type === React.Fragment
            ? flattenButtons(node.props.children)
            : [node];
    }
    return [];
};

const buttonsToMenuItems = (buttons) =>
    flattenButtons(buttons).map((child, i) => (
        <DropDownItem
            key={child.key ?? i}
            name={child.props.label ?? child.props.name}
            icon={child.props.icon}
            onClick={child.props.onClick}
        />
    ));

/** Wraps a leaf row's label so right-click shows the same edit actions the
 * toolbar renders via onGenerateEditButtons for the currently selected item. */
const LeafLabelContextMenu = React.memo(({ node, entity, actions, children }) => {
    const buttons = actions?.getEditButtons(entity);
    const items = buttons ? buttonsToMenuItems(buttons) : [];
    if (!items.length) return children;

    return (
        <MenuRoot onOpenChange={(d) => { if (d.open) actions.onSelect(node); }}>
            <MenuContextTrigger>{children}</MenuContextTrigger>
            <MenuContent>{items}</MenuContent>
        </MenuRoot>
    );
});

const EmptyState = () => (
    <Flex direction="column" align="center" justify="center" gap="8px" py="32px"
        color="gray.500" userSelect="none">
        <Icon as={FaFolder} boxSize={8} opacity={0.25} />
        <Text fontSize="sm">No items</Text>
    </Flex>
);

/** Pseudo-row appended when a folder has more children than the current reveal
 * limit — reveals the next batch instead of mounting everything at once. */
const ShowMoreRow = React.memo(({ count, onReveal }) => (
    <Flex
        align="center" gap="8px" width="100%" px="4px" py="2px"
        color="gray.400" fontSize="sm" fontStyle="italic" cursor="pointer"
        _hover={{ color: "gray.200" }}
        onClick={(e) => { e.stopPropagation(); onReveal(); }}
    >
        Show {count} more…
    </Flex>
));

/** Toolbar — memoised so it never re-renders during tree redraws. */
const Toolbar = React.memo(({
    withAddItem, selectedItem, items, canEditFolders,
    onAddItem, onCreateFolder, onEditFolder, onDeleteFolder, onDeleteAll,
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
            {canEditFolders && (
                <DListItemButton label="Add Folder" icon={FaFolder} onClick={onCreateFolder} />
            )}
            {canEditFolders && isFolder && <>
                <DListItemButton label="Edit Folder"    icon={FaEdit}       onClick={onEditFolder}   />
                <DListItemButton label="Delete Folder"  icon={FaMinusCircle} color="red" onClick={onDeleteFolder} />
                <DListItemButton label="Delete All"     icon={FaTrashAlt}   color="red" onClick={onDeleteAll} />
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
    onDeleteItem,
    onGenerateEditButtons,
    onSelect,
    refreshRef,
    onRefresh,
    canEditFolders,
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
    // How many children of each folder (keyed by parentId, ROOT_KEY for the
    // top level) are currently revealed. "Show N more" bumps a folder's own
    // entry by REVEAL_STEP and re-renders — doesn't need to be React state
    // since renderTree is called directly right after mutating it.
    const expandedLimitsRef = React.useRef(new Map());

    itemsRef.current     = items ?? [];
    treeItemsRef.current = treeItems;
    treeDataRef.current  = treeData;
    filterRef.current    = filter;
    selectedRef.current  = selected;
    entityTypeRef.current = entityType;

    // Keep onDeleteItem in a ref so callbacks don't go stale
    const onDeleteItemRef = React.useRef(onDeleteItem);
    onDeleteItemRef.current = onDeleteItem;

    const onGenerateEditButtonsRef = React.useRef(onGenerateEditButtons);
    onGenerateEditButtonsRef.current = onGenerateEditButtons;
    const canEditFoldersRef = React.useRef(canEditFolders);
    canEditFoldersRef.current = canEditFolders;

    // modal open-fn refs
    const openCreateRef = React.useRef();
    const openEditRef   = React.useRef();
    // Tracks which folder an in-flight "Edit Folder" modal is for — set explicitly
    // by handleEditFolder rather than read from `selected`, since a right-click
    // targets a specific node regardless of what's currently selected.
    const editTargetRef = React.useRef(null);

    // delete-all confirmation dialog state
    const [deleteAllOpen,   setDeleteAllOpen]   = React.useState(false);
    const [deleteAllTarget, setDeleteAllTarget] = React.useState(null); // { id, name, count }

    // Handler refs so the tree's row-rendering closures (built in renderTree,
    // which does NOT depend on these) always call the latest implementation —
    // same pattern as onDeleteItemRef above. Populated once each handler is
    // defined further down.
    const handleSelectRef        = React.useRef(() => {});
    const handleEditFolderRef    = React.useRef(() => {});
    const handleDeleteFolderRef  = React.useRef(() => {});
    const handleOpenDeleteAllRef = React.useRef(() => {});

    // Stable object passed into row context menus — never changes identity, so
    // it's safe to hand to React.memo'd row components without breaking memoization.
    const contextMenuActions = React.useRef({
        onSelect:        (node) => handleSelectRef.current(node),
        onEditFolder:    (node) => handleEditFolderRef.current(node),
        onDeleteFolder:  (node) => handleDeleteFolderRef.current(node),
        onDeleteAllFolder: (node) => handleOpenDeleteAllRef.current(node),
        getEditButtons:  (entity) => onGenerateEditButtonsRef.current?.(entity),
        canEditFolders:  () => canEditFoldersRef.current,
    }).current;

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
            const fullChain   = walkChain(firstItem);
            const parentKey   = firstItem.parentId ?? ROOT_KEY;
            const limit       = expandedLimitsRef.current.get(parentKey) ?? DEFAULT_VISIBLE_ITEMS;
            const visibleChain = fullChain.slice(0, limit);
            const hiddenCount  = fullChain.length - visibleChain.length;

            const nodes = [];
            for (const item of visibleChain) {
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
                                node={item}
                                actions={contextMenuActions}
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
                                <LeafLabelContextMenu node={item} entity={entity} actions={contextMenuActions}>
                                    {_generateItem(entity, item)}
                                </LeafLabelContextMenu>
                            </>
                        ),
                    });
                }
            }

            if (hiddenCount > 0) {
                nodes.push({
                    id: `__more__${parentKey}`,
                    children: [],
                    open: false,
                    arrow: null,
                    label: (
                        <ShowMoreRow
                            count={hiddenCount}
                            onReveal={() => {
                                expandedLimitsRef.current.set(parentKey, limit + REVEAL_STEP);
                                renderTree(treeItemsRef.current, itemsRef.current);
                            }}
                        />
                    ),
                });
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
            // The .representsElement hidden div is a sibling of the generated item
            // inside the ReactTreeList label — not an ancestor or descendant of the
            // actual dragged element. Walk up to the draggable row first, then search
            // down into it to find the hidden div.
            const row = e.target?.closest('[draggable="true"]');
            const id = row?.querySelector(".representsElement")?.id?.split("/")?.[1];
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

    // `folder` is required (not defaulted to selectedRef.current) — the context
    // menu passes the right-clicked node explicitly, which may differ from
    // whatever is currently `selected`. Wire the toolbar's onClick as
    // `() => handleDeleteFolder(selected)` rather than passing this directly,
    // since a raw onClick={handleDeleteFolder} would hand it the click event.
    const handleDeleteFolder = React.useCallback((folder) => {
        if (!folder?.id) return;
        WebSocketManagerInstance.Send({ command: "tree_remove", data: folder.id });
        onFolderDelete?.(folder.id);
    }, [onFolderDelete]);

    // Opens the confirmation dialog for "Delete All" on the given folder.
    const handleOpenDeleteAll = React.useCallback((folder) => {
        if (!folder?.id || !folder.isFolder) return;
        const count = collectDescendants(folder.id, treeItemsRef.current).length;
        setDeleteAllTarget({ id: folder.id, name: folder.name ?? "folder", count });
        setDeleteAllOpen(true);
    }, []);

    // Opens the "Edit Folder" modal for the given folder. Remembers the target
    // in a ref (rather than relying on `selected`) so onCloseModal below saves
    // to the right folder even if selection changes while the modal is open.
    const handleEditFolder = React.useCallback((folder) => {
        if (!folder?.id) return;
        editTargetRef.current = folder;
        // Support both the raw tree item (icon holds the real value, from a
        // right-click) and the processed treeData node (icon is blanked out in
        // favor of itemIcon, from normal selection) — same folder, two shapes.
        openEditRef.current?.({ ...folder, icon: folder.icon ?? folder.itemIcon });
    }, []);

    // Runs the actual recursive deletion after the user confirms. Reads the
    // explicit target captured when the dialog was opened (deleteAllTarget),
    // not selectedRef — selection may have moved on by confirm time.
    // Sends commands in post-order so leaves are deleted before their parent folders.
    // The backend rejects tree_remove on a non-empty folder, so if any item fails
    // (e.g. permission denied) the containing folders survive with remaining items.
    const executeDeleteAll = React.useCallback(() => {
        const folder = deleteAllTarget;
        if (!folder?.id) return;

        const descendants = collectDescendants(folder.id, treeItemsRef.current);

        for (const item of descendants) {
            if (item.isFolder) {
                WebSocketManagerInstance.Send({ command: "tree_remove", data: item.id });
            } else {
                const entity = itemsRef.current.find(x => x.id === item.targetId);
                if (entity && onDeleteItemRef.current) {
                    onDeleteItemRef.current(entity, item);
                } else {
                    // Fallback: remove only the tree entry if no entity-specific handler
                    WebSocketManagerInstance.Send({ command: "tree_remove", data: item.id });
                }
            }
        }

        // Delete the root folder last
        WebSocketManagerInstance.Send({ command: "tree_remove", data: folder.id });
        onFolderDelete?.(folder.id);
    }, [onFolderDelete, deleteAllTarget]);

    // Keep the row-context-menu action refs current now that the real
    // implementations exist (contextMenuActions itself never changes identity).
    handleDeleteFolderRef.current  = handleDeleteFolder;
    handleOpenDeleteAllRef.current = handleOpenDeleteAll;
    handleEditFolderRef.current    = handleEditFolder;

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
    handleSelectRef.current = handleSelect;

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
                    if (success && editTargetRef.current) {
                        WebSocketManagerInstance.Send({
                            command: "tree_update",
                            data: { id: editTargetRef.current.id, name, color, icon },
                        });
                    }
                }}
            />

            {/* Toolbar */}
            <Toolbar
                withAddItem={withAddItem}
                selectedItem={selected}
                items={items}
                canEditFolders={canEditFolders}
                onAddItem={onAddItem}
                onCreateFolder={() => openCreateRef.current?.({ name: "", parent: selected?.id })}
                onEditFolder={() => handleEditFolder(selected)}
                onDeleteFolder={() => handleDeleteFolder(selected)}
                onDeleteAll={() => handleOpenDeleteAll(selected)}
                onGenerateEditButtons={onGenerateEditButtons}
                onRefresh={onRefresh ? () => { fetchTree(); onRefresh(); } : undefined}
                refreshing={loading}
            />

            {/* Search */}
            <Box px="4px" py="4px" flexShrink={0}>
                <SearchInput value={filter} onChange={v => setFilter(v)} />
            </Box>

            {/* Tree body — id={treeId} must be on this always-rendered Box so the
                dragstart delegated listener (attached once on mount) can find it. */}
            <Box id={treeId} flex={1} overflowY="auto">
                {loading ? (
                    <Flex align="center" justify="center" gap="8px" py="24px" color="gray.500">
                        <Spinner size="sm" />
                        <Text fontSize="sm">Loading…</Text>
                    </Flex>
                ) : treeData.length === 0 ? (
                    <EmptyState />
                ) : (
                    <ReactTreeList
                        itemDefaults={{ arrow: "▸" }}
                        data={treeData}
                        onSelected={handleSelect}
                        onChange={setTreeData}
                        onDrop={onDrop}
                    />
                )}
            </Box>

            {/* Delete-all confirmation dialog */}
            <DialogRoot open={deleteAllOpen} onOpenChange={(e) => setDeleteAllOpen(e.open)}>
                <DialogContent maxW="sm">
                    <DialogHeader>
                        <DialogTitle>Delete "{deleteAllTarget?.name}"?</DialogTitle>
                    </DialogHeader>
                    <DialogBody>
                        <Text fontSize="sm">
                            This will delete the folder and all {deleteAllTarget?.count} item(s) inside.
                            Items that cannot be deleted due to insufficient permissions will remain.
                        </Text>
                    </DialogBody>
                    <DialogFooter gap={2}>
                        <Button size="sm" variant="outline" onClick={() => setDeleteAllOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            colorPalette="red"
                            onClick={() => { setDeleteAllOpen(false); executeDeleteAll(); }}
                        >
                            Delete All
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </DialogRoot>
        </Flex>
    );
};

export default DTreeList;