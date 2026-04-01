import * as React from 'react';
import { Box, Flex, Icon, Image, Spinner, Text } from '@chakra-ui/react';
import * as Dockable from "@hlorenzi/react-dockable";
import DList from '../../uiComponents/base/List/DList';
import DLabel from '../../uiComponents/base/Text/DLabel';
import { ActiveWebHelper as WebHelper } from '../../../helpers/transport';
import { BasePanel } from '../../uiComponents/base/BasePanel';
import DContainer from '../../uiComponents/base/Containers/DContainer';
import DListItemButton from '../../uiComponents/base/List/ListItemDetails/DListItemButton';
import { FaCode, FaFile, FaLink, FaMinusCircle, FaMusic, FaPen, FaUpload } from 'react-icons/fa';
import UtilityHelper from '../../../helpers/UtilityHelper';
import DTreeList from '../../uiComponents/treeList/DTreeList';
import CollectionSyncer from '../../uiComponents/base/CollectionSyncer';
import InputModal from '../../uiComponents/base/Modals/InputModal';
import WebSocketManagerInstance from '../WebSocketManager';
import RefreshInfo from '../../uiComponents/treeList/RefreshInfoCard';
import DockableHelper from '../../../helpers/DockableHelper';
import LookupPanel from './Addons/LookupPanel';
import DTreeListItem from '../../uiComponents/base/List/DTreeListItem';
import { toaster } from '../../ui/toaster';

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

// ─── Panel ────────────────────────────────────────────────────────────────────

export const MaterialsPanel = ({ state }) => {
    const [resources, setResources]     = React.useState([]);
    const [ignoreRefresh, setIgnoreRefresh] = React.useState(false);
    const [uploading, setUploading]     = React.useState(false);
    const onFolderRenameOpenRef         = React.useRef(null);
    const treeRefreshRef                = React.useRef(null);

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
                    <Image
                        objectFit="contain"
                        boxSize="36px"
                        borderRadius="sm"
                        src={link}
                        cursor="pointer"
                        onClick={openPreview}
                        fallback={<Icon as={FaFile} boxSize="36px" color="gray.500" />}
                    />
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

            <DContainer height="100%" display="flex" flexDirection="column">
                <CollectionSyncer
                    incrementalUpdate
                    collection={resources}
                    setCollection={setResources}
                    commandPrefix="resource"
                    paused={ignoreRefresh}
                    onAdd={() => treeRefreshRef.current?.()}
                />

                <Box flex="1" overflowY="auto">
                    <DList>
                        <DTreeList
                            items={resources}
                            onGenerateEditButtons={(item) => (
                                <>
                                    <DListItemButton icon={FaLink}        label="Copy link"        onClick={() => generateLink(item.id)} />
                                    <DListItemButton icon={FaPen}         label="Rename"            onClick={() => onFolderRenameOpenRef.current({ name: item.name, id: item.id })} />
                                    <DListItemButton icon={FaMinusCircle} label="Delete" color="red" onClick={() => WebSocketManagerInstance.Send({ command: "resource_delete", data: item.id })} />
                                </>
                            )}
                            generateItem={(item) => (
                                <DTreeListItem entityId={item.id} entityType="ResourceModel" drag>
                                    {getItemBody(item) ?? <DLabel>{item.name}</DLabel>}
                                </DTreeListItem>
                            )}
                            entityType="ResourceModel"
                            refreshRef={treeRefreshRef}
                            onRefresh={loadData}
                        />
                    </DList>
                </Box>

                {/* Upload zone — always visible at the bottom */}
                <Box px={2} py={2} borderTop="1px solid" borderColor={BORDER_CLR} flexShrink={0}>
                    <UploadZone uploading={uploading} onFiles={handleFiles} />
                </Box>
            </DContainer>
        </BasePanel>
    );
};

export default MaterialsPanel;