import * as React from "react";
import {
  Box,
  Button,
  Flex,
  Icon,
  IconButton,
  Spinner,
  Text,
} from "@chakra-ui/react";
import {
  FaCode,
  FaFile,
  FaImage,
  FaMinus,
  FaMusic,
  FaStickyNote,
  FaChevronDown,
  FaChevronUp,
  FaArrowUp,
  FaArrowDown,
  FaSync,
  FaUpload,
} from "react-icons/fa";
import { ActiveWebHelper as WebHelper } from "../../helpers/transport";
import DListItem from "./base/List/DListItem";
import DListItemsButtonContainer from "./base/List/DListItemsButtonContainer";
import DListItemButton from "./base/List/ListItemDetails/DListItemButton";
import CollectionSyncer from "./base/CollectionSyncer";
import DTreeViewOnly from "./treeList/DTreeViewOnly";
import { toaster } from "../ui/toaster";
import uploadMaterials from "../../helpers/uploadMaterials";

// ─── Constants ────────────────────────────────────────────────────────────────

const BG_SURFACE  = "var(--nordvik-background-color, #1a1a2e)";
const BG_DROP     = "rgba(66,153,225,0.08)";
const BG_DROP_HOV = "rgba(66,153,225,0.18)";
const BORDER_CLR  = "whiteAlpha.200";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getIconByMimeType = (mimeType) => {
  if (!mimeType) return FaFile;
  if (mimeType.startsWith("image"))       return FaImage;
  if (mimeType.startsWith("audio"))       return FaMusic;
  if (mimeType.startsWith("text"))        return FaStickyNote;
  if (mimeType.startsWith("application")) return FaCode;
  return FaFile;
};

// The selected materials in the order of the given ids (the order matters when
// orderable, e.g. stylesheets where later ones win).
const inOrder = (materials, ids) =>
  ids.map((id) => materials.find((x) => x.id === id)).filter(Boolean);

// ─── SelectedChip — one chosen material ───────────────────────────────────────

const SelectedChip = React.memo(({ material, isDisabled, onRemove, onMove, isFirst, isLast }) => {
  const IconComp = getIconByMimeType(material.mimeType);
  return (
    <DListItem withHover width="100%">
      <Flex align="center" gap={2} px={1} minW={0} flex="1">
        <Icon as={IconComp} color="gray.400" flexShrink={0} />
        <Text fontSize="xs" noOfLines={1} flex="1" minW={0}>{material.name}</Text>
      </Flex>
      <DListItemsButtonContainer>
        {onMove && (
          <>
            <DListItemButton disabled={isDisabled || isFirst} icon={FaArrowUp} label="Move up" onClick={() => onMove(material.id, -1)} />
            <DListItemButton disabled={isDisabled || isLast} icon={FaArrowDown} label="Move down" onClick={() => onMove(material.id, 1)} />
          </>
        )}
        <DListItemButton
          isDisabled={isDisabled}
          icon={FaMinus}
          color="red"
          onClick={() => onRemove(material.id)}
        />
      </DListItemsButtonContainer>
    </DListItem>
  );
});

// ─── DropZone ─────────────────────────────────────────────────────────────────

const DropZone = React.memo(({ uploading, additionalFilter, onFilesDropped, onFilesSelected }) => {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const fileInputRef = React.useRef(null);

  const handleDragOver  = (e) => { e.preventDefault(); setIsDragOver(true);  };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragOver(false); };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();   // ← Bug 1 fix: prevent bubbling to outer Box handler
    setIsDragOver(false);
    const files = [...e.dataTransfer.items]
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter(Boolean);
    onFilesDropped(files);
  };

  const handleChange = (e) => {
    const files = [...e.target.files];
    onFilesDropped(files);
    e.target.value = "";   // reset so same file can be re-selected
  };

  return (
    <Box
      border="1px dashed"
      borderColor={isDragOver ? "blue.400" : BORDER_CLR}
      borderRadius="md"
      bg={isDragOver ? BG_DROP_HOV : BG_DROP}
      transition="all 0.15s"
      px={3} py={2}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      cursor="pointer"
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleChange}
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

// ─── Main component ───────────────────────────────────────────────────────────

export const MaterialChooser = ({
  onSelect,
  multipleSelection,
  additionalFilter,
  materialsSelected,   // array of IDs
  isDisabled,
  orderable,           // multi-select: show move up/down; the order is kept and reported
}) => {
  const [materials, setMaterials]               = React.useState(null);   // null = loading
  const [selectedMaterials, setSelectedMaterials] = React.useState([]);  const [showPicker, setShowPicker]             = React.useState(false);
  const [uploading, setUploading]               = React.useState(false);
  const [refreshing, setRefreshing]             = React.useState(false);

  // Stable ref for callbacks that need the latest value without re-subscribing
  const materialsRef       = React.useRef(materials);
  const selectedRef        = React.useRef(selectedMaterials);
  materialsRef.current     = materials;
  selectedRef.current      = selectedMaterials;

  // ── load ─────────────────────────────────────────────────────────────────  // Normalise: callers may pass a single ID string or an array of IDs
  const selectedIds = React.useMemo(() => {
    if (!materialsSelected) return [];
    return Array.isArray(materialsSelected) ? materialsSelected : [materialsSelected];
  }, [materialsSelected]);

  const selectedIdsRef = React.useRef(selectedIds);
  React.useLayoutEffect(() => { selectedIdsRef.current = selectedIds; });

  const loadData = React.useCallback(async () => {
    const data = await WebHelper.getAsync("materials/getresources");
    if (!data) return;
    setMaterials(data);
    setSelectedMaterials(inOrder(data, selectedIdsRef.current));
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Re-derive selection whenever materials list or the selection prop changes.
  // Covers: initial load, parent prop updates, and CollectionSyncer removals.
  React.useEffect(() => {
    if (!materials) return;
    setSelectedMaterials(inOrder(materials, selectedIds));
  // selectedIds is derived from materialsSelected; listing both would be redundant.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials, selectedIds]);

  // ── selection helpers ─────────────────────────────────────────────────────

  const commitSelection = React.useCallback((next) => {
    setSelectedMaterials(next);
    if (multipleSelection) {
      onSelect?.(next.map((x) => x.id));
    } else {
      onSelect?.(next[0]?.id ?? null);
    }
  }, [multipleSelection, onSelect]);
  const handleMove = React.useCallback((id, delta) => {
    const next = [...selectedRef.current];
    const index = next.findIndex((x) => x.id === id);
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    commitSelection(next);
  }, [commitSelection]);

  const handleRemove = React.useCallback((id) => {
    const next = selectedRef.current.filter((x) => x.id !== id);
    commitSelection(next);
  }, [commitSelection]);

  // ── upload ────────────────────────────────────────────────────────────────

  const handleFilesDropped = React.useCallback((files) => {
    if (!files.length) return;

    // Filter by additionalFilter if provided (passes a mock object with mimeType)
    const allowed = files.filter((f) => {
      if (!additionalFilter) return true;
      return additionalFilter({ name: f.name, mimeType: f.type });
    });

    const rejected = files.length - allowed.length;
    if (rejected > 0) {
      toaster.create({
        title: "Invalid file type",
        description: `${rejected} file${rejected > 1 ? "s" : ""} skipped — type not allowed.`,
        type: "error",
        duration: 5000,
      });
    }
    if (!allowed.length) return;

    setUploading(true);
    uploadMaterials(allowed).then(async ({ uploaded }) => {
      // Reload once so the tree is fresh, then auto-select the upload if single-select.
      const data = await WebHelper.getAsync("materials/getresources");
      if (data) {
        setMaterials(data);
        const last = uploaded[uploaded.length - 1];
        const match = !multipleSelection && last && data.find((x) => x.id === last.id);
        if (match) commitSelection([match]);
      }
      setUploading(false);
    });
  }, [additionalFilter, multipleSelection, commitSelection]);

  // ── drag-from-tree-list drop ──────────────────────────────────────────────

  const handleDrop = React.useCallback((e) => {
    e.preventDefault();
    if (!e.dataTransfer.items) return;
    const items = [...e.dataTransfer.items];

    // A tree-drag carries one shared payload in sessionStorage, not one per
    // DataTransferItem — but a drop can report more than one 'string'-kind item
    // for the same drag (the tree's own drag data among
    // others). Handling it once per matching item re-added the same material
    // multiple times in multi-select mode (see HandleDrop.js for the battlemap
    // counterpart of this bug). Handle it exactly once here.
    if (items.some((item) => item.kind === "string")) {
      const raw = sessionStorage.getItem("draggable");
      sessionStorage.removeItem("draggable");
      try {
        const dragObj = raw ? JSON.parse(raw) : null;
        if (dragObj?.entityType === "ResourceModel") {
          const mat = materialsRef.current?.find((x) => x.id === dragObj.id);
          if (mat) {
            if (multipleSelection) {
              if (!selectedRef.current.find((x) => x.id === mat.id)) {
                commitSelection([...selectedRef.current, mat]);
              }
            } else {
              commitSelection([mat]);
            }
          }
        }
      } catch { /* ignore */ }
    }

    items.forEach((item) => {
      if (item.kind === "file") {
        handleFilesDropped([item.getAsFile()].filter(Boolean));
      }
    });
  }, [multipleSelection, commitSelection, handleFilesDropped]);
  // ── immediate tree-item toggle (replaces the old Add/Select button) ───────

  const handleTreeItemClick = React.useCallback((treeItem) => {
    if (!treeItem || treeItem.isFolder) return;
    const item = treeItem.itemRef;
    if (!item) return;

    if (multipleSelection) {
      const already = selectedRef.current.find((x) => x.id === item.id);
      const next = already
        ? selectedRef.current.filter((x) => x.id !== item.id)
        : [...selectedRef.current, item];
      commitSelection(next);
    } else {
      // Toggle off if already selected, otherwise select
      const already = selectedRef.current.find((x) => x.id === item.id);
      commitSelection(already ? [] : [item]);
      if (!already) setShowPicker(false);
    }
  }, [multipleSelection, commitSelection]);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <Box onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} width="100%">
      {/* Keep materials in sync with WS resource events */}
      <CollectionSyncer
        collection={materials ?? []}
        setCollection={setMaterials}
        commandPrefix="resource"
      />

      {/* Selected items */}
      {selectedMaterials.length > 0 && (
        <Box mb={2}>
          {selectedMaterials.map((mat, index) => (
            <SelectedChip
              key={mat.id}
              material={mat}
              isDisabled={isDisabled}
              onRemove={handleRemove}
              onMove={orderable ? handleMove : undefined}
              isFirst={index === 0}
              isLast={index === selectedMaterials.length - 1}
            />
          ))}
        </Box>
      )}

      {/* Toggle button + Refresh button row */}
      <Flex gap={1} align="center">
        <Button
          size="xs"
          variant="outline"
          flex="1"
          disabled={isDisabled}
          onClick={() => setShowPicker((v) => !v)}
        >
          <Icon as={showPicker ? FaChevronUp : FaChevronDown} mr={1} />
          {showPicker ? "Close picker" : (selectedMaterials.length > 0 ? "Change" : "Select material")}
        </Button>
        <IconButton
          aria-label="Refresh"
          title="Refresh"
          size="xs"
          variant="ghost"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <Icon as={FaSync} boxSize="11px" style={refreshing ? { animation: "spin 0.8s linear infinite" } : undefined} />
        </IconButton>
      </Flex>

      {/* Picker panel */}
      {showPicker && (
        <Box
          mt={2}
          border="1px solid"
          borderColor={BORDER_CLR}
          borderRadius="md"
          bg={BG_SURFACE}
          overflow="hidden"
          w="100%"
        >
          {/* Tree — clicking an item immediately commits the selection */}
          <Box maxH="260px" overflowY="auto" px={1} pt={1}>
            {materials === null ? (
              <Flex justify="center" py={4}>
                <Spinner size="sm" color="gray.400" />
              </Flex>
            ) : (
            <DTreeViewOnly
                additionalFilter={additionalFilter}
                items={materials}
                entityType="ResourceModel"
                labelKey={selectedMaterials.map((x) => x.id).join(",")}
                generateItem={(item, treeItem) => {
                  const IconComp = getIconByMimeType(item.mimeType);
                  const isSelected = !!selectedMaterials.find((x) => x.id === item.id);
                  return (
                    <Flex
                      align="center"
                      gap={2}
                      px={2}
                      py="3px"
                      borderRadius="sm"
                      bg={isSelected ? "var(--nordvik-selection-color, #2d3a5a)" : undefined}
                      _hover={{ bg: "whiteAlpha.100" }}
                      transition="background 0.1s"
                      w="100%"
                      cursor="pointer"
                    >
                      {/* Checkbox (multi) or radio indicator (single) */}
                      <Flex
                        flexShrink={0}
                        align="center"
                        justify="center"
                        w="14px" h="14px"
                        borderRadius={multipleSelection ? "3px" : "50%"}
                        border="1.5px solid"
                        borderColor={isSelected ? "blue.400" : "whiteAlpha.400"}
                        bg={isSelected ? "blue.500" : "transparent"}
                        transition="all 0.1s"
                      >
                        {isSelected && (
                          <Box
                            w={multipleSelection ? "8px" : "6px"}
                            h={multipleSelection ? "8px" : "6px"}
                            borderRadius={multipleSelection ? "1px" : "50%"}
                            bg="white"
                          />
                        )}
                      </Flex>
                      <Icon as={IconComp} color="gray.400" flexShrink={0} boxSize={3} />
                      <Text fontSize="xs" noOfLines={1}>{item.name}</Text>
                    </Flex>
                  );
                }}
                onSelect={(treeItem) => handleTreeItemClick(treeItem)}
              />
            )}
          </Box>

          {/* Drop zone */}
          <Box px={2} py={2} borderTop="1px solid" borderColor={BORDER_CLR}>
            <DropZone
              uploading={uploading}
              additionalFilter={additionalFilter}
              onFilesDropped={handleFilesDropped}
            />
          </Box>

          {/* Close row */}
          <Flex px={2} py={2} borderTop="1px solid" borderColor={BORDER_CLR} justify="flex-end">
            <Button size="xs" variant="ghost" onClick={() => setShowPicker(false)}>
              Close
            </Button>
          </Flex>
        </Box>
      )}
    </Box>
  );
};

export default MaterialChooser;
