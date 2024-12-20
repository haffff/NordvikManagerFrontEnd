import { Box, Button, Card, CardBody, Flex, HStack, Input, Text } from '@chakra-ui/react';
import * as React from 'react';
import Subscribable from '../base/Subscribable';
import { ReactTreeList } from '@bartaxyz/react-tree-list';
import WebSocketManagerInstance from '../../game/WebSocketManager';
import InputModal from '../base/Modals/InputModal';
import WebHelper from '../../../helpers/WebHelper';
import { FaEdit, FaFolder, FaICursor, FaMinusCircle, FaPlus, FaSearch, FaTrash } from 'react-icons/fa';
import DListItemButton from '../base/List/ListItemDetails/DListItemButton';
import DListItem from '../base/List/DListItem';
import DynamicIcon from '../icons/DynamicIcon';
import UtilityHelper from '../../../helpers/UtilityHelper';

export const DTreeList = ({ withAddItem, selectedItemOverwrite, onAddItem, items, generateItem, entityType, onFolderDelete, onGenerateEditButtons, onSelect }) => {
    generateItem = generateItem || ((x) => x.name);
    const [treeItems, setTreeItems] = React.useState([]);
    const [treeData, setTreeData] = React.useState([]);
    const [selectedItem, setSelectedItem] = React.useState(null);

    const [treeId, setTreeId] = React.useState(UtilityHelper.GenerateUUID());
    const subListRef = React.useRef([]);

    const [filter, setFilter] = React.useState("");

    const filterRef = React.useRef(filter);
    filterRef.current = filter;

    const itemsRef = React.useRef(items ?? []);
    itemsRef.current = items;

    const treeItemsRef = React.useRef(treeItems);
    const treeDataRef = React.useRef([]);
    const treeComponentRef = React.useRef();

    const MainFolderConfig = [
        { key: "name", label: "Folder Name", toolTip: "Name of folder.", type: "string" },
        { key: "color", label: "Color", toolTip: "Name of folder.", type: "color" },
        { key: "icon", label: "Icon", toolTip: "Name of folder.", type: "iconSelect" },
    ];
    const ParentConfig = { key: "parent", label: "Add after", toolTip: "Add folder after this element.", type: "select", options: [] };

    const onOpen = React.useRef();
    const onFolderRenameOpenRef = React.useRef();

    treeDataRef.current = treeData;
    treeItemsRef.current = treeItems;

    React.useEffect(() => {
        renderTree(treeItemsRef.current, itemsRef.current);
    }, [filter]);

    const handleChange = (item) => {
        setTreeData(item);
    }

    function LoadData() {
        if (entityType && itemsRef.current)
            WebHelper.get(`battlemap/getTree?entityType=${entityType}`, (response) => {
                setTreeItems(response);
                renderTree(response, itemsRef.current);
            });
    }

    const dragStart = (e) => {
        let element = e.target;
        let id = element.querySelector('.representsElement')?.id?.split("/")[1];
        if (id === undefined || id === null || id.startsWith('f-')) {
            return;
        }
        sessionStorage.setItem("draggable", JSON.stringify({ entityType, id }));
    }

    React.useEffect(() => {
        let treeParent = document.getElementById(treeId);
        let tree = treeParent?.childNodes[0];
        if (tree) {
            let components = tree?.childNodes;
            if (components.length === 0)
                return;

            for (let i = 0; i < components.length; i++) {
                //if (!subListRef.current.includes(components[i].className)) {
                //subListRef.current.push(components[i].className);
                let component = components[i];
                component.addEventListener("dragstart", dragStart);
                //}
            }
        }
    }, [treeData]);

    React.useEffect(() => {
        LoadData();
    }, [entityType, items]);

    const generateFolder = ({ id, name, icon, color }, isOpen) => {
        return <DListItem id={treeId + "/f-" + id} backgroundColor={color} ><Flex verticalAlign={'center'} width={'300px'}> {(icon ? <Box style={{ marginRight: "15px", marginTop: "3px" }} ><DynamicIcon iconName={icon} /></Box> : <FaFolder style={{ marginRight: "15px", marginTop: "3px" }} />)}{name}</Flex></DListItem>;
    }

    const HandleMessage = (response) => {
        const items = itemsRef.current;
        switch (response.command) {
            case `tree_add`:
            case `tree_update`:
                if(response.data.find(x=>x && x.entryType !== entityType))
                {
                    return;
                }
                const treeItems = structuredClone(treeItemsRef.current);
                response.data.forEach(element => {
                    if (!element)
                        return;
                    const foundItem = treeItems.find(x => x.id === element.id);
                    if (foundItem) {
                        const index = treeItems.indexOf(foundItem);
                        treeItems[index] = element;
                    }
                    else {
                        if (element.autoConnect) {
                            treeItems.push(element);
                        }
                    }
                });

                setTreeItems(treeItems);
                renderTree(treeItems, items);
                break;
            case `tree_remove`:
                //Find id and remove it
                const treeItemsRemove = structuredClone(treeItemsRef.current);
                const foundItem = treeItemsRemove.find(x => x.id === response.data);
                if (foundItem) {
                    const index = treeItemsRemove.indexOf(foundItem);
                    treeItemsRemove.splice(index, 1);
                }

                setTreeItems(treeItemsRemove);
                renderTree(treeItemsRemove, items);
                break;
        }
    }

    const CreateFolder = ({ name, parent, color, icon }) => {
        WebSocketManagerInstance.Send({ command: `tree_add`, data: { name, entryType: entityType, color, icon, next: parent, parentId: null, isFolder: true, autoConnect: true } });
    };

    const onDrop = (draggingNode, dragNode, dragType) => {

        const parentId = dragNode.parent?.id;

        switch (dragType) {
            case 'inner':
                if (!dragNode.isFolder) {
                    renderTree(treeItemsRef.current, itemsRef.current);
                    return;
                }

                WebSocketManagerInstance.Send({
                    command: `tree_update`, data: {
                        id: draggingNode.id,
                        parentId: dragNode.id,
                        next: null
                    }
                });
                break;
            case 'after':
                if (dragNode?.nextInstance?.id === draggingNode.id) {
                    renderTree(treeItemsRef.current, itemsRef.current);
                    return;
                }
                WebSocketManagerInstance.Send({
                    command: `tree_update`, data: {
                        id: draggingNode.id,
                        parentId: parentId,
                        next: dragNode?.nextInstance?.id
                    }
                });
                break;
            case 'before':
                WebSocketManagerInstance.Send({
                    command: `tree_update`, data: {
                        id: draggingNode.id,
                        parentId: parentId,
                        next: dragNode.id,
                    }
                });
                break;
        }
    };

    const renderTree = (treeItems, items) => {
        if (!treeItems)
            return;
        let data = [];

        const _getOpenStates = (children, arr) => {
            if (!children)
                return;
            children.forEach(x => {
                if (x.open) {
                    arr[x.id] = true;
                }
                if (x.children) {
                    _getOpenStates(x.children, arr);
                }
            });
        }

        const getOpenStates = () => {
            let openStates = [];
            _getOpenStates(treeDataRef.current, openStates);
            return openStates;
        }

        let openStates = getOpenStates();

        treeItems.forEach(x => {
            x.nextInstance = treeItems.find(y => x.next === y.id);
            x.parent = treeItems.find(y => x.parentId === y.id);
        });

        let firstElement = treeItems.find(x => !x.parent && treeItems.findIndex(y => y.nextInstance === x) === -1);
        let path = "";

        const addArray = (firstItem, array, path) => {
            let item = firstItem;
            while (item) {
                let firstChild = treeItems.find(x => x.parent == item && x.head);
                if (firstChild) {
                    const children = [];
                    addArray(firstChild, children, path + "/" + item.parent?.name);
                    const foundItem = items.find(x => x.id === item.targetId);

                    if (!item.isFolder && (!foundItem || !foundItem.name.includes(filterRef.current))) {
                        item = item.nextInstance;
                        continue;
                    }

                    array.push({ ...item, icon: undefined, itemIcon: item.icon, children, label: item.isFolder ? generateFolder(item) : generateItem(foundItem, item), itemRef: foundItem, open: openStates[item.id], path: path });
                }
                else {
                    const foundItem = items.find(x => x.id === item.targetId);

                    if (!item.isFolder && (!foundItem || !foundItem.name.includes(filterRef.current))) {
                        item = item.nextInstance;
                        continue;
                    }

                    array.push({ ...item, icon: undefined, itemIcon: item.icon, label: item.isFolder ? generateFolder(item) : <><div style={{ display: 'none' }} className='representsElement' id={treeId + "/" + foundItem.id} />{generateItem(foundItem, item)}</>, itemRef: foundItem, open: openStates[item.id], path: path });
                }
                item = item.nextInstance;
            }
        }

        addArray(firstElement, data, path);

        setTreeData(data);
    }

    const constructPath = (item) => {
        let path = "";
        let parent = item.parent;
        while (parent) {
            path = parent.name + "/" + path;
            parent = parent.parent;
        }
        return path;
    }

    const getRenameLabel = (item) => {
        let path = constructPath(item);
        if (item.isFolder) {
            return (path ? path + item?.name : item?.name)
        }
        else {
            let foundItem = itemsRef.current.find(x => x.id === item.targetId);
            return (path ? path + foundItem?.name : foundItem?.name);
        }
    }

    return (
        <>
            <Subscribable commandPrefix={"tree_"} onMessage={HandleMessage} />
            <InputModal
                title="Create new folder"
                getConfigDict={() => {
                    return [...MainFolderConfig, { ...ParentConfig, options: treeItemsRef.current.map(x => { return { value: x.id, label: getRenameLabel(x) } }) }]
                }}
                openRef={onOpen}
                onCloseModal={(data, success) => { if (success) { CreateFolder(data) } }} />
            <InputModal
                title={"Rename folder"}
                getConfigDict={() => MainFolderConfig}
                openRef={onFolderRenameOpenRef}
                onCloseModal={({ name, color, icon }, success) => {
                    if (success) {
                        WebSocketManagerInstance.Send({
                            command: `tree_update`, data: { id: selectedItem.id, name, color, icon }
                        })
                    }
                }} />
            <HStack>
                {withAddItem ? <DListItemButton label={"Add Item"} icon={FaPlus} onClick={() => { onAddItem(selectedItem) }} /> : <></>}
                <DListItemButton label={"Add Folder"} icon={FaFolder} onClick={() => { onOpen.current({ name: "", parent: selectedItem?.id }) }} />
                {selectedItem?.isFolder ?
                    <>
                        <DListItemButton label={"Edit"} icon={FaEdit} onClick={() => { onFolderRenameOpenRef.current({ ...selectedItem, icon: selectedItem.itemIcon }) }} />
                        <DListItemButton label={"Delete"} icon={FaMinusCircle} color={'red'} onClick={() => { WebSocketManagerInstance.Send({ command: `tree_remove`, data: selectedItem.id }) }} />
                    </> : (onGenerateEditButtons ? onGenerateEditButtons(items.find(x => x.id === selectedItem?.targetId)) : <></>)}
            </HStack>
            <HStack>
                <Input size={'xs'} placeholder="Search" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </HStack>
            <div id={treeId}>
                <ReactTreeList itemDefaults={{ arrow: "▸" }} data={treeData} onSelected={(s) => {
                    setSelectedItem(s);
                    onSelect && onSelect(s);
                }} onChange={handleChange} onDrop={onDrop} />
            </div>
            <Flex>
            </Flex>
        </>
    );
}
export default DTreeList;