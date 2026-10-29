import { Box, Button, Flex, HStack, Icon, IconButton, Spinner, Text } from '@chakra-ui/react';
import * as React from 'react';
import Subscribable from '../base/Subscribable';
import { ActiveTransportManager as WebSocketManagerInstance } from '../../../helpers/transport';
import InputModal from '../base/Modals/InputModal';
import { ActiveWebHelper as WebHelper } from '../../../helpers/transport';
import { FaEdit } from '@react-icons/all-files/fa/FaEdit';
import { FaFolder } from '@react-icons/all-files/fa/FaFolder';
import { FaMinusCircle } from '@react-icons/all-files/fa/FaMinusCircle';
import { FaPlus } from '@react-icons/all-files/fa/FaPlus';
import { FaSync } from '@react-icons/all-files/fa/FaSync';
import { FaTrashAlt } from '@react-icons/all-files/fa/FaTrashAlt';
import { FaCopy } from '@react-icons/all-files/fa/FaCopy';
import { FaFileExport } from '@react-icons/all-files/fa/FaFileExport';
import { FaFileImport } from '@react-icons/all-files/fa/FaFileImport';
import { FaFolderOpen } from '@react-icons/all-files/fa/FaFolderOpen';
import { toaster } from '../../ui/toaster';
import { duplicateEntity } from '../../../helpers/entityTransfer';
import { ExportJsonDialog, ImportJsonDialog } from './TransferDialogs';
import { MoveToFolderDialog } from './MoveToFolderDialog';
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
import AddonMenuItems from '../base/DDItems/AddonMenuItems';
import { getMenuItems, setMenuContext, subscribeMenuItems } from '../base/DDItems/menuItemsStore';
import themeColors from '../../../helpers/themeColors';
import { TreeView } from '../tree/TreeView';
import { buildTree, collectDescendants, computeMove, computeMoveMany, entryPath, splitMatch, treeOrder } from '../tree/treeModel';
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

const NO_ADDON_ITEMS = Object.freeze([]);

/** Wraps a leaf row's label so right-click shows the same edit actions the
 * toolbar renders via onGenerateEditButtons for the currently selected item,
 * plus any addon items for the list's addonMenu location (Add Menu Item). */
const LeafLabelContextMenu = React.memo(({ node, entity, actions, children }) => {
    const addonMenu = actions?.getAddonMenu();
    const addonItems = React.useSyncExternalStore(
        subscribeMenuItems,
        () => (addonMenu?.viewId ? getMenuItems(addonMenu.viewId) : NO_ADDON_ITEMS)
    );
    const buttons = actions?.getEditButtons(entity);
    const items = buttons ? buttonsToMenuItems(buttons) : [];
    if (!items.length && !addonItems.length) return children;

    return (
        <MenuRoot onOpenChange={(d) => {
            if (!d.open) return;
            actions.onSelect(node);
            if (addonMenu?.viewId) setMenuContext(addonMenu.viewId, addonMenu.context?.(entity) ?? { id: entity?.id });
        }}>
            <MenuContextTrigger>{children}</MenuContextTrigger>
            <MenuContent>
                {items}
                {addonMenu?.viewId && <AddonMenuItems viewId={addonMenu.viewId} />}
            </MenuContent>
        </MenuRoot>
    );
});

/** The greyed "+ New … here" row closing each open folder (and the top level). */
export const AddRow = ({ label, onClick, children }) => (
    <Flex align="center" gap="10px" py="3px" fontSize="xs" color="gray.500" opacity={0.75} _hover={{ opacity: 1 }}>
        {label && (
            <Box as="button" type="button" onClick={onClick} display="flex" alignItems="center" gap="6px"
                bg="transparent" border="none" p={0} cursor="pointer" color="inherit" fontStyle="italic">
                <Icon as={FaPlus} boxSize="9px" />
                <span>{label}</span>
            </Box>
        )}
        {children}
    </Flex>
);

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
    onGenerateEditButtons, onImport, onRefresh, refreshing, onMoveToFolder,
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
            {onImport && (
                <DListItemButton label="Import JSON" icon={FaFileImport} onClick={onImport} />
            )}
            {canEditFolders && isFolder && <>
                <DListItemButton label="Edit Folder"    icon={FaEdit}       onClick={onEditFolder}   />
                <DListItemButton label="Delete Folder"  icon={FaMinusCircle} color="red" onClick={onDeleteFolder} />
                <DListItemButton label="Delete All"     icon={FaTrashAlt}   color="red" onClick={onDeleteAll} />
            </>}
            {!isFolder && targetEntity && onGenerateEditButtons?.(targetEntity)}
            {canEditFolders && selectedItem && (
                <DListItemButton label="Move to folder…" icon={FaFolderOpen} onClick={onMoveToFolder} />
            )}
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
    // Optional { viewId, context: (entity) => variables }: a menu location addons can add
    // right-click items to (Add Menu Item), e.g. "cards_item" for the Cards panel.
    addonMenu,
    // What the tree holds for Duplicate / Export JSON / Import JSON ("map", "card",
    // "template", "view", "playlist", "soundboard"; see helpers/entityTransfer.js). Offered
    // to whoever can edit folders (Edit on the game, which the server checks too).
    transferKind,
    // A greyed "+ <addRowLabel> here" row ends every open folder and the top level (with
    // withAddItem); it calls onAddItem(selected, { parentId }), parentId null at the top.
    // renderAddRow(parentId) draws that row instead, e.g. with more than one action.
    addRowLabel,
    renderAddRow,
}) => {
    const _generateItem = React.useMemo(
        () => generateItem ?? ((x) => x?.name ?? ""),
        [generateItem]
    );

    // ── state ──────────────────────────────────────────────────────────────────
    const [treeItems, setTreeItems] = React.useState([]);
    const [selected,  setSelected]  = React.useState(null);
    // Every selected entry (Ctrl/⌘, Shift-click), with the Shift range's anchor; dragging
    // one of them moves them all.
    const [selection, setSelection] = React.useState({ ids: new Set(), anchorId: null });
    const [filter,    setFilter]    = React.useState("");
    const [loading,   setLoading]   = React.useState(false);
    const [openIds, setOpen, pruneOpen] = useRememberedOpenFolders(entityType);

    // ── stable refs ────────────────────────────────────────────────────────────
    const treeId        = React.useId().replace(/:/g, "");
    const itemsRef      = React.useRef(items ?? []);
    const treeItemsRef  = React.useRef([]);
    const entityTypeRef = React.useRef(entityType);
    const selectionRef  = React.useRef(selection);
    const nodesRef      = React.useRef([]);
    itemsRef.current      = items ?? [];
    treeItemsRef.current  = treeItems;
    selectionRef.current  = selection;
    entityTypeRef.current = entityType;

    const onAddItemRef = React.useRef(onAddItem);
    onAddItemRef.current = onAddItem;
    const onDeleteItemRef = React.useRef(onDeleteItem);
    onDeleteItemRef.current = onDeleteItem;
    const onGenerateEditButtonsRef = React.useRef(onGenerateEditButtons);
    onGenerateEditButtonsRef.current = onGenerateEditButtons;
    const canEditFoldersRef = React.useRef(canEditFolders);
    canEditFoldersRef.current = canEditFolders;
    const addonMenuRef = React.useRef(addonMenu);
    addonMenuRef.current = addonMenu;
    const canTransfer = Boolean(transferKind) && Boolean(canEditFolders);
    const transferRef = React.useRef({ kind: transferKind, enabled: canTransfer });
    transferRef.current = { kind: transferKind, enabled: canTransfer };

    // Export JSON dialog's entity; Import JSON dialog open.
    const [exporting, setExporting] = React.useState(null);
    const [importOpen, setImportOpen] = React.useState(false);
    // "Move to folder…": the entries it moves (the selection, in tree order), while open.
    const [moving, setMoving] = React.useState(null);

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
    const editButtonsRef         = React.useRef(() => null);

    // Stable object passed into row context menus — never changes identity.
    const contextMenuActions = React.useRef({
        onSelect:          (node) => handleSelectRef.current(node),
        onEditFolder:      (node) => handleEditFolderRef.current(node),
        onDeleteFolder:    (node) => handleDeleteFolderRef.current(node),
        onDeleteAllFolder: (node) => handleOpenDeleteAllRef.current(node),
        getEditButtons:    (entity) => editButtonsRef.current(entity),
        canEditFolders:    () => canEditFoldersRef.current,
        getAddonMenu:      () => addonMenuRef.current,
    }).current;

    // ── tree ───────────────────────────────────────────────────────────────────
    // Whoever can't edit folders doesn't see the ones with nothing in it for them.
    const nodes = React.useMemo(
        () => buildTree(treeItems, items ?? [], { hideEmptyFolders: !canEditFolders }),
        [treeItems, items, canEditFolders]);
    nodesRef.current = nodes;

    // Drop remembered open folders that no longer exist.
    React.useEffect(() => {
        if (!treeItems.length) return;
        pruneOpen(new Set(treeItems.filter(x => x.isFolder).map(x => x.id)));
    }, [treeItems, pruneOpen]);

    // ── selectedItemOverwrite — let parent drive selection ─────────────────────
    React.useEffect(() => {
        if (selectedItemOverwrite === undefined) return;
        setSelected(selectedItemOverwrite ?? null);
        const id = selectedItemOverwrite?.id;
        setSelection({ ids: new Set(id ? [id] : []), anchorId: id ?? null });
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
            setSelection(s => {
                if (!s.ids.has(data)) return s;
                const ids = new Set(s.ids);
                ids.delete(data);
                return { ids, anchorId: s.anchorId === data ? null : s.anchorId };
            });
        }
    }, [fetchTree]);

    // ── moving ─────────────────────────────────────────────────────────────────
    // A row of a multi-selection takes the whole selection with it, in tree order; one
    // update each, sent in that order so they land in it.
    const handleMove = React.useCallback((dragId, targetId, position) => {
        const { ids } = selectionRef.current;
        if (ids.size > 1 && ids.has(dragId)) {
            const ordered = treeOrder(nodesRef.current).filter(id => ids.has(id));
            for (const payload of computeMoveMany(treeItemsRef.current, ordered, targetId, position)) {
                WebSocketManagerInstance.Send({ command: "tree_update", data: payload });
            }
            return;
        }
        const payload = computeMove(treeItemsRef.current, dragId, targetId, position);
        if (payload) WebSocketManagerInstance.Send({ command: "tree_update", data: payload });
    }, []);

    // The toolbar's "Move to folder…" (touch screens can't drag rows): the selection, or
    // the selected row, to the end of a folder or of the top level.
    const openMoveToFolder = React.useCallback(() => {
        const { ids } = selectionRef.current;
        const sel = selectedRef.current;
        const picked = ids.size > 1 && sel && ids.has(sel.id) ? ids : new Set(sel ? [sel.id] : []);
        setMoving(treeOrder(nodesRef.current).filter(id => picked.has(id)));
    }, []);
    const handleMoveToFolder = React.useCallback((folderId) => {
        const position = folderId ? "inside" : "end";
        for (const payload of computeMoveMany(treeItemsRef.current, moving ?? [], folderId, position)) {
            WebSocketManagerInstance.Send({ command: "tree_update", data: payload });
        }
        setMoving(null);
    }, [moving]);

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
        setSelection({ ids: new Set(sel?.id ? [sel.id] : []), anchorId: sel?.id ?? null });
        onSelect?.(sel);
    }, [onSelect]);

    // Ctrl/⌘ and Shift clicks only change which rows are selected; the toolbar and the
    // panel keep following the last plainly clicked one.
    const handleSelectionChange = React.useCallback((next) => setSelection(next), []);

    // ── duplicate / export / import ────────────────────────────────────────────
    const reportMissing = (missing) => {
        if (!missing?.length) return;
        toaster.create({
            title: "Some files weren't found",
            description: `Not in this game, left out: ${missing.join(", ")}`,
            type: "warning",
            duration: 10000,
        });
    };

    // The item, or every selected one (in tree order, folders left out) when it's part of
    // a multi-selection; each copy goes right after its original.
    const handleDuplicate = React.useCallback(async (entity) => {
        const entries = treeItemsRef.current;
        const own = entries.find(x => !x.isFolder && x.targetId === entity.id);
        const { ids } = selectionRef.current;
        const targets = own && ids.size > 1 && ids.has(own.id)
            ? treeOrder(nodesRef.current).filter(id => ids.has(id))
                .map(id => entries.find(x => x.id === id))
                .filter(x => x && !x.isFolder)
            : [own ?? { targetId: entity.id }];

        for (const entry of targets) {
            try {
                const { missing } = await duplicateEntity(transferRef.current.kind, entry.targetId, entry.id ? entry : null);
                reportMissing(missing);
            } catch (e) {
                toaster.create({ title: "Couldn't duplicate", description: e.message, type: "error" });
            }
        }
    }, []);

    // The row's own buttons (the panel's) plus Duplicate and Export JSON, for the toolbar
    // and the right-click menu alike.
    const generateEditButtons = React.useCallback((entity) => {
        const own = onGenerateEditButtonsRef.current?.(entity);
        if (!transferRef.current.enabled) return own ?? null;
        return (
            <>
                {own}
                <DListItemButton label="Duplicate" icon={FaCopy} onClick={() => handleDuplicate(entity)} />
                <DListItemButton label="Export JSON" icon={FaFileExport} onClick={() => setExporting(entity)} />
            </>
        );
    }, [handleDuplicate]);
    editButtonsRef.current = generateEditButtons;

    // Into the selected folder, or the selected item's folder.
    const importParentId = selected?.isFolder ? selected.id : (selected?.parentId ?? null);
    const openImport = React.useCallback(() => setImportOpen(true), []);

    const selectedRef = React.useRef(selected);
    selectedRef.current = selected;
    const drawAddRow = React.useCallback((parentId) => (
        <AddRow
            label={parentId ? `${addRowLabel} here` : addRowLabel}
            onClick={() => onAddItemRef.current?.(selectedRef.current, { parentId })}
        />
    ), [addRowLabel]);
    const addRow = renderAddRow ?? (withAddItem && addRowLabel ? drawAddRow : undefined);

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
                onGenerateEditButtons={canTransfer || onGenerateEditButtons ? generateEditButtons : undefined}
                onImport={canTransfer ? openImport : undefined}
                onRefresh={onRefresh ? () => { fetchTree(); onRefresh(); } : undefined}
                refreshing={loading}
                onMoveToFolder={openMoveToFolder}
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
                        selectedIds={selection.ids}
                        anchorId={selection.anchorId}
                        onSelectionChange={handleSelectionChange}
                        renderLabel={renderLabel}
                        draggable
                        onMove={handleMove}
                        onRowDragStart={handleRowDragStart}
                        estimatedRowHeight={estimatedRowHeight}
                        renderAddRow={addRow}
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

            <MoveToFolderDialog
                entries={treeItems}
                moving={moving}
                onPick={handleMoveToFolder}
                onClose={() => setMoving(null)}
            />

            {canTransfer && <>
                <ExportJsonDialog kind={transferKind} entity={exporting} onClose={() => setExporting(null)} />
                <ImportJsonDialog
                    open={importOpen}
                    kind={transferKind}
                    parentId={importParentId}
                    onClose={() => setImportOpen(false)}
                    onImported={({ missing }) => reportMissing(missing)}
                />
            </>}
        </Flex>
    );
};

export default DTreeList;
