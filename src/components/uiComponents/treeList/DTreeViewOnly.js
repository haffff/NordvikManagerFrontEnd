import { Box, Flex, Input, Text } from '@chakra-ui/react';
import * as React from 'react';
import Subscribable from '../base/Subscribable';
import { ActiveWebHelper as WebHelper } from '../../../helpers/transport';
import DListItem from '../base/List/DListItem';
import DynamicIcon from '../icons/DynamicIcon';
import { FaFolder } from 'react-icons/fa';
import { TreeView } from '../tree/TreeView';
import { buildTree, splitMatch } from '../tree/treeModel';
import { useRememberedOpenFolders } from '../tree/useRememberedOpenFolders';

// Read-only folder tree (e.g. the material chooser): browse, search and pick items.
// Same tree model and view as DTreeList, without editing or drag & drop.

const FolderRow = ({ name, icon, color, query }) => (
    <DListItem backgroundColor={color}>
        <Flex align="center" gap="10px">
            {icon ? <DynamicIcon iconName={icon} /> : <FaFolder />}
            <Text fontSize="sm" truncate>
                {splitMatch(name, query).map((p, i) => p.match
                    ? <Box as="mark" key={i} bg="rgba(236,201,75,0.35)" color="inherit">{p.text}</Box>
                    : <React.Fragment key={i}>{p.text}</React.Fragment>)}
            </Text>
        </Flex>
    </DListItem>
);

export const DTreeViewOnly = ({ items, generateItem, entityType, onSelect, additionalFilter, labelKey }) => {
    const [treeItems, setTreeItems] = React.useState([]);
    const [filter, setFilter] = React.useState("");
    const [selectedId, setSelectedId] = React.useState(null);
    // Kept apart from the editable tree's folders, so browsing here doesn't change the panel's.
    const [openIds, setOpen] = useRememberedOpenFolders(entityType ? `${entityType}.chooser` : "chooser");

    const generate = generateItem ?? ((x) => x.name);
    const entityTypeRef = React.useRef(entityType);
    entityTypeRef.current = entityType;

    React.useEffect(() => {
        if (!entityType) return;
        WebHelper.get(`battlemap/getTree?entityType=${entityType}`, (response) => {
            setTreeItems(Array.isArray(response) ? response : []);
        });
    }, [entityType]);

    const handleMessage = React.useCallback((response) => {
        const data = response.data;
        switch (response.command) {
            case "tree_add":
            case "tree_update": {
                const incoming = (Array.isArray(data) ? data : [data]).filter(Boolean);
                if (incoming.some(x => x.entryType && x.entryType !== entityTypeRef.current)) return;
                setTreeItems(prev => {
                    const next = [...prev];
                    for (const el of incoming) {
                        const idx = next.findIndex(x => x.id === el.id);
                        if (idx !== -1) next[idx] = el;
                        else if (el.autoConnect) next.push(el);
                    }
                    return next;
                });
                break;
            }
            case "tree_remove":
                setTreeItems(prev => prev.filter(x => x.id !== data));
                break;
            default:
                break;
        }
    }, []);

    // additionalFilter is usually an inline function, so rebuild when the items or the
    // caller's labelKey change rather than on every render.
    const filterRef = React.useRef(additionalFilter);
    filterRef.current = additionalFilter;
    const nodes = React.useMemo(
        () => buildTree(treeItems, items ?? [], { additionalFilter: (e) => !filterRef.current || filterRef.current(e) }),
        [treeItems, items, labelKey], // eslint-disable-line react-hooks/exhaustive-deps
    );

    // labelKey changes when the caller's selection changes; it's part of renderLabel's
    // identity so rows re-render with their new look.
    const renderLabel = React.useCallback((node, { query }) => node.isFolder
        ? <FolderRow name={node.name} icon={node.entry.icon} color={node.entry.color} query={query} />
        : generate(node.entity, node.entry),
    [generate, labelKey]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        // Fixed height: the tree scrolls (and virtualizes) inside it.
        <Flex direction="column" h="250px">
            <Subscribable commandPrefix={"tree_"} onMessage={handleMessage} />
            <Input size="xs" placeholder="Search" value={filter} onChange={(e) => setFilter(e.target.value)} mb={1} />
            <Flex flex={1} minH={0} direction="column">
                <TreeView
                    nodes={nodes}
                    openIds={openIds}
                    onToggle={setOpen}
                    query={filter}
                    selectedId={selectedId}
                    onSelect={(node) => {
                        setSelectedId(node.id);
                        onSelect?.({ ...node.entry, itemIcon: node.entry.icon, itemRef: node.entity ?? undefined });
                    }}
                    renderLabel={renderLabel}
                    emptyState={
                        <Text fontSize="sm" color="gray.500" textAlign="center" py={6}>
                            {filter.trim() ? "Nothing matches the search" : "Nothing here yet"}
                        </Text>
                    }
                    ariaLabel="Choose an item"
                />
            </Flex>
        </Flex>
    );
};

export default DTreeViewOnly;
