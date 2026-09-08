import * as React from 'react';
import { Box, Button, Flex, Icon, Image, Spinner, Tabs, Text } from '@chakra-ui/react';
import * as Dockable from "@hlorenzi/react-dockable";
import DList from '../../uiComponents/base/List/DList';
import DLabel from '../../uiComponents/base/Text/DLabel';
import { ActiveWebHelper as WebHelper } from '../../../helpers/transport';
import { BasePanel } from '../../uiComponents/base/BasePanel';
import DContainer from '../../uiComponents/base/Containers/DContainer';
import DListItemButton from '../../uiComponents/base/List/ListItemDetails/DListItemButton';
import {
    FaArrowLeft, FaCode, FaDatabase, FaExchangeAlt, FaExternalLinkAlt, FaFile, FaFolder,
    FaHdd, FaLink, FaMinusCircle, FaMusic, FaPen, FaPlus, FaUpload,
} from 'react-icons/fa';
import UtilityHelper from '../../../helpers/UtilityHelper';
import DTreeList from '../../uiComponents/treeList/DTreeList';
import CollectionSyncer from '../../uiComponents/base/CollectionSyncer';
import InputModal from '../../uiComponents/base/Modals/InputModal';
import { ActiveTransportManager as WebSocketManagerInstance } from '../../../helpers/transport';
import RefreshInfo from '../../uiComponents/treeList/RefreshInfoCard';
import DockableHelper from '../../../helpers/DockableHelper';
import ClientMediator from '../../../ClientMediator';
import { usePermissions } from '../../../contexts/PermissionsContext';
import { ENTITY_TYPES, PERM } from '../../BattleMap/Helpers/permissionBits';
import LookupPanel from './Addons/LookupPanel';
import DTreeListItem from '../../uiComponents/base/List/DTreeListItem';
import { toaster } from '../../ui/toaster';
import ResourceImage from '../../uiComponents/ResourceImage';
import { Tooltip } from '../../ui/tooltip';
import {
    DialogRoot, DialogContent, DialogBody, DialogCloseTrigger, DialogHeader, DialogFooter, DialogTitle,
} from '../../ui/dialog';
import ProgressToastManager from '../../../helpers/ProgressToastManager';

// ─── Constants ────────────────────────────────────────────────────────────────

const BORDER_CLR  = "whiteAlpha.200";
const BG_DROP     = "rgba(66,153,225,0.06)";
const BG_DROP_HOV = "rgba(66,153,225,0.16)";

// ─── UploadZone ───────────────────────────────────────────────────────────────

const UploadZone = React.memo(({ uploading, onFiles }) => {
    const [isDragOver, setIsDragOver] = React.useState(false);
    const fileInputRef = React.useRef(null);

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const files = [...e.dataTransfer.items]
            .filter((i) => i.kind === "file")
            .map((i) => i.getAsFile())
            .filter(Boolean);
        onFiles(files);
    };

    return (
        <Box
            border="1px dashed"
            borderColor={isDragOver ? "blue.400" : BORDER_CLR}
            borderRadius="md"
            bg={isDragOver ? BG_DROP_HOV : BG_DROP}
            transition="all 0.15s"
            px={3} py={3}
            cursor="pointer"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
        >
            <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={(e) => { onFiles([...e.target.files]); e.target.value = ""; }}
            />
            <Flex align="center" justify="center" gap={2} pointerEvents="none">
                {uploading
                    ? <><Spinner size="xs" color="blue.300" /><Text fontSize="xs" color="gray.400">Uploading…</Text></>
                    : <><Icon as={FaUpload} color={isDragOver ? "blue.300" : "gray.500"} />
                        <Text fontSize="xs" color={isDragOver ? "blue.300" : "gray.500"}>
                            Drop files or click to upload
                        </Text></>
                }
            </Flex>
        </Box>
    );
});

// ─── Storage badge ──────────────────────────────────────────────────────────
// ResourceModel.Storage: 0 = Blob (in the DB), 1 = ManagedFile (on disk, app-owned),
// 2 = Linked (on disk, GM-owned, never touched by delete — only "unlink" removes the row).
const STORAGE_META = {
    0: { icon: FaDatabase, color: "blue.300", label: "Stored in database" },
    1: { icon: FaHdd, color: "green.300", label: "Stored as a file on disk" },
    2: { icon: FaExternalLinkAlt, color: "orange.300", label: "Linked to a file on disk (not copied)" },
};

const StorageBadge = React.memo(({ storage }) => {
    const meta = STORAGE_META[storage ?? 0] ?? STORAGE_META[0];
    return <Icon as={meta.icon} boxSize={3} color={meta.color} title={meta.label} flexShrink={0} />;
});

// ─── LinkBrowserModal ───────────────────────────────────────────────────────
// GM-only local filesystem browser (backed by Materials/BrowseLocalDirectory) — lets the GM
// pick an existing file or folder on the machine running this backend to link in without
// copying its bytes. A browser can't hand JS a real OS path (File System Access API only
// exposes sandboxed handles), so this has to be a small server-driven browser instead of a
// native picker.
const LinkBrowserModal = ({ open, onClose, onLinked }) => {
    const [currentPath, setCurrentPath] = React.useState(null); // null = drive roots
    const [entries, setEntries] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [linking, setLinking] = React.useState(false);
    const linkingOperationIdRef = React.useRef(null);

    const load = React.useCallback((path) => {
        setLoading(true);
        const query = path ? `?path=${encodeURIComponent(path)}` : "";
        WebHelper.getAsync(`Materials/BrowseLocalDirectory${query}`)
            .then((data) => setEntries(Array.isArray(data) ? data : []))
            .catch((e) => {
                console.error("LinkBrowserModal: browse failed", e);
                setEntries([]);
            })
            .finally(() => setLoading(false));
    }, []);

    React.useEffect(() => {
        if (open) { setCurrentPath(null); load(null); }
    }, [open, load]);

    const navigateInto = (entry) => { setCurrentPath(entry.fullPath); load(entry.fullPath); };

    // Best-effort parent path — good enough for browsing, doesn't need to be OS-perfect.
    const navigateUp = () => {
        if (!currentPath) return;
        const trimmed = currentPath.replace(/[\\/]+$/, "");
        const idx = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
        const parent = idx > 0 ? trimmed.slice(0, idx) : null;
        setCurrentPath(parent);
        load(parent);
    };

    const linkFile = async (entry) => {
        setBusy(true);
        const { status, body } = await WebHelper.postAsync("Materials/LinkResource", {
            Name: entry.name,
            LocalPath: entry.fullPath,
        });
        setBusy(false);
        if (status < 200 || status >= 300) {
            toaster.create({ title: "Failed to link file", description: body?.error, type: "error", duration: 5000 });
            return;
        }
        onLinked();
    };

    const linkCurrentFolder = async () => {
        if (!currentPath) return;
        setBusy(true);
        setLinking(true);
        // Big folders can take a while on the backend, so this just kicks the walk off — the
        // actual progress/completion arrives as a toast, driven by operation_progress/
        // complete/failed via ProgressToastManager.
        const { status, body } = await WebHelper.postAsync("Materials/LinkDirectory", {
            LocalDirectoryPath: currentPath,
        });
        setBusy(false);
        if (status < 200 || status >= 300 || !body?.started) {
            setLinking(false);
            toaster.create({ title: "Failed to link folder", description: body?.error, type: "error", duration: 5000 });
            return;
        }
        linkingOperationIdRef.current = body.operationId;
        ProgressToastManager.start(body.operationId, { title: "Linking folder…" });
    };

    // Local UI concerns only (re-enable the button, refresh the file list) — the toast
    // itself is driven independently by ProgressToastManager's own Progress:* subscriptions.
    React.useEffect(() => {
        const onComplete = (data) => {
            if (data?.id !== linkingOperationIdRef.current) return;
            setLinking(false);
            onLinked();
        };
        const onFailed = (data) => {
            if (data?.id !== linkingOperationIdRef.current) return;
            setLinking(false);
        };
        const completeHandle = ClientMediator.on("Progress:Complete", onComplete);
        const failedHandle = ClientMediator.on("Progress:Failed", onFailed);
        return () => {
            ClientMediator.off(completeHandle);
            ClientMediator.off(failedHandle);
        };
    }, [onLinked]);

    return (
        <DialogRoot lazyMount size="lg" open={open} onOpenChange={(e) => { if (!e.open) onClose(); }}>
            <DialogContent>
                <DialogCloseTrigger />
                <DialogHeader><DialogTitle>Link local files or folders</DialogTitle></DialogHeader>
                <DialogBody>
                    <Flex align="center" gap={2} mb={2}>
                        <DListItemButton icon={FaArrowLeft} label="Up one level" hidden={!currentPath || linking} onClick={navigateUp} />
                        <Text fontSize="xs" color="gray.400" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" flex="1">
                            {currentPath ?? "This computer"}
                        </Text>
                        <Button size="xs" variant="outline" onClick={linkCurrentFolder} disabled={!currentPath || busy || linking}>
                            Link this folder
                        </Button>
                    </Flex>

                    {loading ? (
                        <Flex justify="center" py={4}><Spinner size="sm" /></Flex>
                    ) : (
                        <Box maxH="360px" overflowY="auto">
                            {entries.map((entry) => (
                                <Flex key={entry.fullPath} align="center" gap={2} py={1} px={2} borderRadius="sm" _hover={{ bg: "whiteAlpha.100" }}>
                                    <Icon as={entry.isDirectory ? FaFolder : FaFile} color={entry.isDirectory ? "yellow.400" : "gray.400"} flexShrink={0} />
                                    <Text
                                        fontSize="sm"
                                        flex="1"
                                        overflow="hidden"
                                        textOverflow="ellipsis"
                                        whiteSpace="nowrap"
                                        cursor={entry.isDirectory ? "pointer" : "default"}
                                        onClick={entry.isDirectory ? () => navigateInto(entry) : undefined}
                                    >
                                        {entry.name}
                                    </Text>
                                    {!entry.isDirectory && (
                                        <Button size="2xs" variant="outline" onClick={() => linkFile(entry)} disabled={busy}>
                                            Link
                                        </Button>
                                    )}
                                </Flex>
                            ))}
                            {entries.length === 0 && <Text fontSize="xs" color="gray.500" px={2}>Empty</Text>}
                        </Box>
                    )}
                </DialogBody>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </DialogRoot>
    );
};

// ─── Panel ────────────────────────────────────────────────────────────────────

export const MaterialsPanel = ({ state }) => {
    const [resources, setResources]     = React.useState([]);
    const [ignoreRefresh, setIgnoreRefresh] = React.useState(false);
    const [uploading, setUploading]     = React.useState(false);
    const [linkModalOpen, setLinkModalOpen] = React.useState(false);
    const onFolderRenameOpenRef         = React.useRef(null);
    const treeRefreshRef                = React.useRef(null);

    const { hasEntityPermission, isGM } = usePermissions();
    const gameId = React.useMemo(() => ClientMediator.sendCommand("Game", "GetGameId"), []);
    const canEditFolders = hasEntityPermission(ENTITY_TYPES.GAME, gameId, PERM.EDIT);

    const currentPlayer = React.useMemo(() => ClientMediator.sendCommand("Game", "GetCurrentPlayer"), []);

    // For the "All Resources" GM tab: prefix each resource's path with the owner's name
    // so DTreeList groups them into per-player folders automatically.
    const allResources = React.useMemo(() =>
        resources.map(r => ({
            ...r,
            path: r.playerName
                ? (r.path ? `${r.playerName}/${r.path}` : r.playerName)
                : (r.path ?? null),
        })),
    [resources]);

    const myResources = React.useMemo(() =>
        currentPlayer
            ? resources.filter(r => r.playerId === currentPlayer.id)
            : resources,
    [resources, currentPlayer]);

    const loadData = React.useCallback(() => {
        WebHelper.get("materials/getresources",
            (response) => setResources(response),
            (error)    => console.error(error)
        );
    }, []);

    React.useEffect(() => { loadData(); }, [loadData]);

    const ctx = Dockable.useContentContext();
    ctx.setTitle("Materials");

    // ── upload ──────────────────────────────────────────────────────────────

    const handleFiles = React.useCallback((files) => {
        if (!files.length) return;
        setIgnoreRefresh(true);
        setUploading(true);

        let remaining = files.length;
        const done = () => {
            remaining -= 1;
            if (remaining === 0) {
                setUploading(false);
                setIgnoreRefresh(false);
                loadData();
                treeRefreshRef.current?.();
            }
        };

        files.forEach((file) => {
            WebHelper.postMaterial(file, done, (err) => {
                console.error("MaterialsPanel: upload error", err);
                toaster.create({ title: "Upload failed", description: file.name, type: "error", duration: 5000 });
                done();
            });
        });
    }, [loadData]);

    // ── external drag-onto-panel ────────────────────────────────────────────

    const handlePanelDrop = (e) => {
        e.preventDefault();
        const files = [...e.dataTransfer.items]
            .filter((i) => i.kind === "file")
            .map((i) => i.getAsFile())
            .filter(Boolean);
        if (files.length) handleFiles(files);
    };

    // ── storage transfer ────────────────────────────────────────────────────
    // Moves an existing resource's bytes between storage modes (GM-only, enforced
    // server-side too). TargetStorage: 0 = Blob, 1 = ManagedFile — you can never transfer
    // *to* Linked, only create a Linked resource via the link browser above.
    const handleTransfer = React.useCallback(async (item, targetStorage) => {
        const { status, body } = await WebHelper.postAsync("Materials/TransferResourceStorage", {
            ResourceId: item.id,
            TargetStorage: targetStorage,
        });
        if (status < 200 || status >= 300) {
            toaster.create({ title: "Failed to change storage", description: body?.error, type: "error", duration: 5000 });
            return;
        }
        loadData();
    }, [loadData]);

    const handleLinked = React.useCallback(() => {
        setLinkModalOpen(false);
        loadData();
        treeRefreshRef.current?.();
    }, [loadData]);

    // ── link copy ───────────────────────────────────────────────────────────

    const generateLink = React.useCallback((id) => {
        const url = WebHelper.getResourceString(id);
        if (navigator.clipboard) {
            navigator.clipboard.writeText(url);
            toaster.create(UtilityHelper.GenerateCopiedToast());
        } else {
            window.prompt("Copy to clipboard: Ctrl+C, Enter", url);
        }
    }, []);

    // ── item body ───────────────────────────────────────────────────────────

    const getItemBody = React.useCallback((item) => {
        const link = WebHelper.getResourceString(item.id);

        const openPreview = () => DockableHelper.NewFloating(state, <LookupPanel
            name={item.name}
            content={link}
            contentType={item.mimeType}
            isUrl={true}
        />);

        const openText = () => WebHelper.getMaterial(item.id, item.mimeType, (result) =>
            DockableHelper.NewFloating(state, <LookupPanel
                name={item.name}
                content={result}
                contentType={item.mimeType}
            />),
            (err) => console.error(err)
        );

        if (item.mimeType?.startsWith("image")) {
            return (
                <>
                    <Tooltip
                        openDelay={1000}
                        closeDelay={0}
                        contentProps={{
                            bg: "var(--nordvik-secondary-color)",
                            color: "var(--nordvik-text-color)",
                        }}
                        content={
                            <Flex direction="column" alignItems="center" gap="4px" p="2px">
                                <ResourceImage id={item.id} height="200px" fallbackSrc={undefined} />
                                <Text fontSize="12px" fontWeight="medium">{item.name}</Text>
                            </Flex>
                        }
                    >
                        <Box flexShrink={0}>
                            <ResourceImage
                                id={item.id}
                                objectFit="contain"
                                boxSize="36px"
                                borderRadius="sm"
                                cursor="pointer"
                                onClick={openPreview}
                                fallbackSrc={undefined}
                            />
                        </Box>
                    </Tooltip>
                    <DLabel>{item.name}</DLabel>
                </>
            );
        }
        if (item.mimeType?.startsWith("audio")) {
            return (
                <>
                    <Icon as={FaMusic} boxSize={5} color="purple.300" cursor="pointer" onClick={openPreview} />
                    <DLabel>{item.name}</DLabel>
                </>
            );
        }
        if (item.mimeType?.startsWith("text") || item.mimeType?.startsWith("application")) {
            return (
                <>
                    <Icon as={FaCode} boxSize={5} color="green.300" cursor="pointer" onClick={openText} />
                    <DLabel>{item.name}</DLabel>
                </>
            );
        }
        return (
            <>
                <Icon as={FaFile} boxSize={5} color="gray.400" />
                <DLabel>{item.name}</DLabel>
            </>
        );
    }, [state]);

    // ── shared resource list renderer ───────────────────────────────────────

    const renderResourceList = (items, { readOnly = false } = {}) => (
        <Box flex="1" overflowY="auto">
            <DList>
                <DTreeList
                    items={items}
                    canEditFolders={canEditFolders && !readOnly}
                    onDeleteItem={(item) => WebSocketManagerInstance.Send({ command: "resource_delete", data: item.id })}
                    onGenerateEditButtons={readOnly ? undefined : (item) => {
                        const isLinked = item.storage === 2;
                        return (
                            <>
                                <DListItemButton icon={FaLink} label="Copy link" onClick={() => generateLink(item.id)} />
                                <DListItemButton icon={FaPen}  label="Rename"    onClick={() => onFolderRenameOpenRef.current({ name: item.name, id: item.id })} />
                                {isGM && item.storage !== 1 && (
                                    <DListItemButton
                                        icon={FaExchangeAlt}
                                        label={isLinked ? "Adopt as file on disk" : "Store as file on disk"}
                                        onClick={() => handleTransfer(item, 1)}
                                    />
                                )}
                                {isGM && item.storage !== 0 && (
                                    <DListItemButton
                                        icon={FaDatabase}
                                        label={isLinked ? "Adopt as database entry" : "Store in database"}
                                        onClick={() => handleTransfer(item, 0)}
                                    />
                                )}
                                <DListItemButton
                                    icon={isLinked ? FaExternalLinkAlt : FaMinusCircle}
                                    color="red"
                                    label={isLinked ? "Unlink (file on disk is kept)" : "Delete"}
                                    onClick={() => WebSocketManagerInstance.Send({ command: "resource_delete", data: item.id })}
                                />
                            </>
                        );
                    }}
                    generateItem={(item) => (
                        <DTreeListItem entityId={item.id} entityType="ResourceModel" drag>
                            {getItemBody(item) ?? <DLabel>{item.name}</DLabel>}
                            <StorageBadge storage={item.storage} />
                        </DTreeListItem>
                    )}
                    entityType="ResourceModel"
                    refreshRef={readOnly ? undefined : treeRefreshRef}
                    onRefresh={loadData}
                />
            </DList>
        </Box>
    );

    // ── render ──────────────────────────────────────────────────────────────

    return (
        <BasePanel onDragOver={(e) => e.preventDefault()} onDrop={handlePanelDrop}>
            <InputModal
                title="Rename Resource"
                getConfigDict={() => [{ key: "name", label: "Resource Name", toolTip: "Name of Resource.", type: "string", required: true }]}
                openRef={onFolderRenameOpenRef}
                onCloseModal={({ name, id }, success) => {
                    if (success) WebSocketManagerInstance.Send({ command: "resource_update", data: { id, name } });
                }}
            />

            {isGM && (
                <LinkBrowserModal
                    open={linkModalOpen}
                    onClose={() => setLinkModalOpen(false)}
                    onLinked={handleLinked}
                />
            )}

            <DContainer height="100%" display="flex" flexDirection="column">
                <CollectionSyncer
                    incrementalUpdate
                    collection={resources}
                    setCollection={setResources}
                    commandPrefix="resource"
                    paused={ignoreRefresh}
                    onAdd={() => treeRefreshRef.current?.()}
                />

                {isGM ? (
                    <Tabs.Root defaultValue="mine" display="flex" flexDirection="column" flex="1" minH={0}>
                        <Tabs.List flexShrink={0}>
                            <Tabs.Trigger value="mine">My Materials</Tabs.Trigger>
                            <Tabs.Trigger value="all">All Resources</Tabs.Trigger>
                        </Tabs.List>

                        <Tabs.Content value="mine" display="flex" flexDirection="column" flex="1" minH={0} p={0}>
                            {renderResourceList(myResources)}
                            <Box px={2} py={2} borderTop="1px solid" borderColor={BORDER_CLR} flexShrink={0} display="flex" flexDirection="column" gap={2}>
                                <UploadZone uploading={uploading} onFiles={handleFiles} />
                                <Button size="xs" variant="outline" onClick={() => setLinkModalOpen(true)}>
                                    <Flex align="center" gap={2}>
                                        <Icon as={FaPlus} boxSize={3} />
                                        <span>Link local file or folder…</span>
                                    </Flex>
                                </Button>
                            </Box>
                        </Tabs.Content>

                        <Tabs.Content value="all" display="flex" flexDirection="column" flex="1" minH={0} p={0}>
                            {renderResourceList(allResources)}
                        </Tabs.Content>
                    </Tabs.Root>
                ) : (
                    <>
                        {renderResourceList(resources)}
                        <Box px={2} py={2} borderTop="1px solid" borderColor={BORDER_CLR} flexShrink={0}>
                            <UploadZone uploading={uploading} onFiles={handleFiles} />
                        </Box>
                    </>
                )}
            </DContainer>
        </BasePanel>
    );
};

export default MaterialsPanel;