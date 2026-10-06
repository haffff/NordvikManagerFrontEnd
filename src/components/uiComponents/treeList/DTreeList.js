import { Box, Button, Flex, HStack, Icon, IconButton, Spinner, Text } from '@chakra-ui/react';
import * as React from 'react';
import Subscribable from '../base/Subscribable';
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
import { SearchInput } from '../SearchInput';
import { MenuContent, MenuContextTrigger, MenuRoot } from '../../ui/menu';
import DropDownItem from '../base/DDItems/DropDownItem';
import themeColors from '../../../helpers/themeColors';
import { TreeView } from '../tree/TreeView';
import { buildTree, collectDescendants, computeMove, entryPath, splitMatch } from '../tree/treeModel';
import { useRememberedOpenFolders } from '../tree/useRememberedOpenFolders';

// Folder tree for a game's materials, cards, … backed by the server's tree entries.
// Rows are drawn by TreeView; moves are sent to the server and the tree re-renders from
// its answer (tree_update), so what you see always matches what's stored.

// ─── module-level constants ───────────────────────────────────────────────────

const FOLDER_CONFIG = [
    { key: "name",  label: "Folder Name", toolTip: "Name of folder.", type: "string"    },
    { key: "color", label: "Color",       toolTip: "Color of folder.", type: "color"     },
    { key: "icon",  label: "Icon",        toolTip: "Icon of folder.",  type: "iconSelect" },
];

// The selection handed to the toolbar and to onSelect: the tree entry's fields plus the
// entity it points at (itemRef), same shape as before.
const toSelection = (node) =>
    node ? { ...node.entry, itemIcon: node.entry.icon, itemRef: node.entity ?? undefined } : null;

// ─── sub-components ───────────────────────────────────────────────────────────

const Highlighted = ({ text, query }) => (
    <>
        {splitMatch(text, query).map((p, i) => p.match
            ? <Box as="mark" key={i} bg="rgba(236,201,75,0.35)" color="inherit" borderRadius="2px">{p.text}</Box>
            : <React.Fragment key={i}>{p.text}</React.Fragment>)}
    </>
);

const FolderLabel = React.memo(({ id, name, icon, color, treeId, node, actions, query }) => {
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
                    <Highlighted text={name} query={query} />
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

const EmptyState = ({ searching }) => (
    <Flex direction="column" align="center" justify="center" gap="8px" py="32px"
        color="gray.500" userSelect="none">
        <Icon as={FaFolder} boxSize={8} opacity={0.25} />
        <Text fontSize="sm">{searching ? "Nothing matches the search" : "No items"}</Text>
    </Flex>
);

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
            borderBottomWidth="1px" borderColor={themeColors.border}>
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
    estimatedRowHeight,
}) => {
    const _generateItem = React.useMemo(
        () => generateItem ?? ((x) => x?.name ?? ""),
        [generateItem]
    );

    // ── state ──────────────────────────────────────────────────────────────────
    const [treeItems, setTreeItems] = React.useState([]);
    const [selected,  setSelected]  = React.useState(null);
    const [filter,    setFilter]    = React.useState("");
    const [loading,   setLoading]   = React.useState(false);
    const [openIds, setOpen, pruneOpen] = useRememberedOpenFolders(entityType);

    // ── stable refs ────────────────────────────────────────────────────────────
    const treeId        = React.useId().replace(/:/g, "");
    const itemsRef      = React.useRef(items ?? []);
    const treeItemsRef  = React.useRef([]);
    const entityTypeRef = React.useRef(entityType);
    itemsRef.current      = items ?? [];
    treeItemsRef.current  = treeItems;
    entityTypeRef.current = entityType;

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

    // Handler refs so row labels (memoised) always call the latest implementation.
    const handleSelectRef        = React.useRef(() => {});
    const handleEditFolderRef    = React.useRef(() => {});
    const handleDeleteFolderRef  = React.useRef(() => {});
    const handleOpenDeleteAllRef = React.useRef(() => {});

    // Stable object passed into row context menus — never changes identity.
    const contextMenuActions = React.useRef({
        onSelect:          (node) => handleSelectRef.current(node),
        onEditFolder:      (node) => handleEditFolderRef.current(node),
        onDeleteFolder:    (node) => handleDeleteFolderRef.current(node),
        onDeleteAllFolder: (node) => handleOpenDeleteAllRef.current(node),
        getEditButtons:    (entity) => onGenerateEditButtonsRef.current?.(entity),
        canEditFolders:    () => canEditFoldersRef.current,
    }).current;

    // ── tree ───────────────────────────────────────────────────────────────────
    const nodes = React.useMemo(() => buildTree(treeItems, items ?? []), [treeItems, items]);

    // Drop remembered open folders that no longer exist.
    React.useEffect(() => {
        if (!treeItems.length) return;
        pruneOpen(new Set(treeItems.filter(x => x.isFolder).map(x => x.id)));
    }, [treeItems, pruneOpen]);

    // ── selectedItemOverwrite — let parent drive selection ─────────────────────
    React.useEffect(() => {
        if (selectedItemOverwrite === undefined) return;
        setSelected(selectedItemOverwrite ?? null);
    }, [selectedItemOverwrite]);

    // ── loading ────────────────────────────────────────────────────────────────
    const fetchTree = React.useCallback(() => {
        if (!entityTypeRef.current) return;
        setLoading(true);
        WebHelper.get(
            `battlemap/getTree?entityType=${entityTypeRef.current}`,
            (response) => {
                setLoading(false);
                setTreeItems(Array.isArray(response) ? response : []);
            },
            () => setLoading(false),
        );
    }, []);

    React.useEffect(() => {
        if (refreshRef) refreshRef.current = fetchTree;
    }, [refreshRef, fetchTree]);

    React.useEffect(() => {
        if (!entityType) return;
        fetchTree();
    }, [entityType, fetchTree]);

    // ── server sync ────────────────────────────────────────────────────────────
    const handleMessage = React.useCallback((response) => {
        const { command, data } = response;

        if (command === "tree_add" || command === "tree_update") {
            const incoming = (Array.isArray(data) ? data : [data]).filter(Boolean);
            if (incoming.some(x => x.entryType && x.entryType !== entityTypeRef.current)) return;

            // A brand-new entry the server placed itself (no autoConnect) can't be inserted
            // locally — its place in the sibling chain is decided server-side — so reload.
            const current = treeItemsRef.current;
            const needsFullRefresh = command === "tree_add" &&
                incoming.some(el => !el.autoConnect && !current.find(x => x.id === el.id));

            setTreeItems(prev => {
                const next = [...prev];
                for (const el of incoming) {
                    const idx = next.findIndex(x => x.id === el.id);
                    if (idx !== -1) next[idx] = el;
                    else if (el.autoConnect) next.push(el);
                }
                return next;
            });

            if (needsFullRefresh) fetchTree();
            return;
        }

        if (command === "tree_remove") {
            setTreeItems(prev => prev.filter(x => x.id !== data));
            setSelected(sel => sel?.id === data ? null : sel);
        }
    }, [fetchTree]);

    // ── moving ─────────────────────────────────────────────────────────────────
    const handleMove = React.useCallback((dragId, targetId, position) => {
        const payload = computeMove(treeItemsRef.current, dragId, targetId, position);
        if (payload) WebSocketManagerInstance.Send({ command: "tree_update", data: payload });
    }, []);

    // Dragging a leaf onto the battle map: HandleDrop reads this payload.
    const handleRowDragStart = React.useCallback((node) => {
        if (node.isFolder || !node.entity) return;
        sessionStorage.setItem("draggable", JSON.stringify({ entityType: entityTypeRef.current, id: node.entity.id }));
    }, []);

    // ── folder operations ──────────────────────────────────────────────────────
    const handleCreateFolder = React.useCallback(({ name, parent, color, icon }) => {
        WebSocketManagerInstance.Send({
            command: "tree_add",
            data: { name, color, icon, entryType: entityType,
                    next: parent ?? null, parentId: null, isFolder: true, autoConnect: true },
        });
    }, [entityType]);

    // `folder` is required (not defaulted to selected) — the context menu passes the
    // right-clicked node explicitly, which may differ from whatever is selected.
    const handleDeleteFolder = React.useCallback((folder) => {
        if (!folder?.id) return;
        WebSocketManagerInstance.Send({ command: "tree_remove", data: folder.id });
        onFolderDelete?.(folder.id);
    }, [onFolderDelete]);

    const handleOpenDeleteAll = React.useCallback((folder) => {
        if (!folder?.id || !folder.isFolder) return;
        const count = collectDescendants(folder.id, treeItemsRef.current).length;
        setDeleteAllTarget({ id: folder.id, name: folder.name ?? "folder", count });
        setDeleteAllOpen(true);
    }, []);

    // Remembers the target in a ref (rather than relying on `selected`) so the modal
    // saves to the right folder even if selection changes while it's open.
    const handleEditFolder = React.useCallback((folder) => {
        if (!folder?.id) return;
        editTargetRef.current = folder;
        openEditRef.current?.({ ...folder, icon: folder.icon ?? folder.itemIcon });
    }, []);

    // Deletes leaves first, then their folders (the server refuses non-empty folders, so
    // anything that fails to delete — e.g. no permission — keeps its folder alive).
    const executeDeleteAll = React.useCallback(() => {
        const folder = deleteAllTarget;
        if (!folder?.id) return;

        for (const item of collectDescendants(folder.id, treeItemsRef.current)) {
            if (item.isFolder) {
                WebSocketManagerInstance.Send({ command: "tree_remove", data: item.id });
            } else {
                const entity = itemsRef.current.find(x => x.id === item.targetId);
                if (entity && onDeleteItemRef.current) onDeleteItemRef.current(entity, item);
                else WebSocketManagerInstance.Send({ command: "tree_remove", data: item.id });
            }
        }

        WebSocketManagerInstance.Send({ command: "tree_remove", data: folder.id });
        onFolderDelete?.(folder.id);
    }, [onFolderDelete, deleteAllTarget]);

    // ── selection ──────────────────────────────────────────────────────────────
    // Accepts a tree node (from TreeView) or an already-shaped selection (context menus).
    const handleSelect = React.useCallback((nodeOrSelection) => {
        const sel = nodeOrSelection?.entry ? toSelection(nodeOrSelection) : nodeOrSelection;
        setSelected(sel);
        onSelect?.(sel);
    }, [onSelect]);

    handleSelectRef.current        = handleSelect;
    handleDeleteFolderRef.current  = handleDeleteFolder;
    handleOpenDeleteAllRef.current = handleOpenDeleteAll;
    handleEditFolderRef.current    = handleEditFolder;

    // "Add after" choices in the create-folder modal, with folder paths.
    const getFolderOptions = () =>
        treeItemsRef.current.map(x => {
            const name = x.isFolder
                ? x.name
                : (itemsRef.current.find(e => e.id === x.targetId)?.name ?? "");
            return { value: x.id, label: entryPath(x.id, treeItemsRef.current) + name };
        });

    // ── labels ─────────────────────────────────────────────────────────────────
    const renderLabel = React.useCallback((node, { query }) => {
        const sel = toSelection(node);
        if (node.isFolder) {
            return (
                <FolderLabel
                    id={node.id} name={node.name} icon={node.entry.icon} color={node.entry.color}
                    treeId={treeId} node={sel} actions={contextMenuActions} query={query}
                />
            );
        }
        return (
            <LeafLabelContextMenu node={sel} entity={node.entity} actions={contextMenuActions}>
                {_generateItem(node.entity, node.entry)}
            </LeafLabelContextMenu>
        );
    }, [_generateItem, treeId, contextMenuActions]);

    // ── render ─────────────────────────────────────────────────────────────────
    return (
        <Flex direction="column" height="100%" flex={1} minH={0} overflow="hidden" gap={0}>
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

            <Box px="4px" py="4px" flexShrink={0}>
                <SearchInput value={filter} onChange={v => setFilter(v)} />
            </Box>

            <Flex id={treeId} flex={1} minH={0} direction="column">
                {loading && !treeItems.length ? (
                    <Flex align="center" justify="center" gap="8px" py="24px" color="gray.500">
                        <Spinner size="sm" />
                        <Text fontSize="sm">Loading…</Text>
                    </Flex>
                ) : (
                    <TreeView
                        nodes={nodes}
                        openIds={openIds}
                        onToggle={setOpen}
                        query={filter}
                        selectedId={selected?.id ?? null}
                        onSelect={handleSelect}
                        renderLabel={renderLabel}
                        draggable
                        onMove={handleMove}
                        onRowDragStart={handleRowDragStart}
                        estimatedRowHeight={estimatedRowHeight}
                        emptyState={<EmptyState searching={!!filter.trim()} />}
                        ariaLabel={entityType ? `${entityType} tree` : "Tree"}
                    />
                )}
            </Flex>

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
