import { Box, Button, Card, CardBody, Flex, HStack, Input, Text } from '@chakra-ui/react';
import * as React from 'react';
import Subscribable from '../base/Subscribable';
import { ReactTreeList } from '@bartaxyz/react-tree-list';
import WebHelper from '../../../helpers/WebHelper';
import DListItem from '../base/List/DListItem';
import DynamicIcon from '../icons/DynamicIcon';
import { FaFolder, FaSearch } from 'react-icons/fa';
import { render } from 'react-dom';

export const DTreeViewOnly = ({ items, generateItem, entityType, onSelect, additionalFilter }) => {
    generateItem = generateItem || ((x) => x.name);
    const [treeItems, setTreeItems] = React.useState([]);
    const [treeData, setTreeData] = React.useState([]);
    const [selectedItem, setSelectedItem] = React.useState(null);

    const [filter, setFilter] = React.useState("");

    const itemsRef = React.useRef(items);
    itemsRef.current = items;

    const treeItemsRef = React.useRef(treeItems);
    const treeDataRef = React.useRef([]);
    const treeComponentRef = React.useRef();

    treeDataRef.current = treeData;
    treeItemsRef.current = treeItems;

    const filterRef = React.useRef(filter);
    filterRef.current = filter;

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

    React.useEffect(() => {
        LoadData();
    }, [entityType, items]);

    const HandleMessage = (response) => {
        const items = itemsRef.current;
        switch (response.command) {
            case `tree_add`:
            case `tree_update`:
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
                break;
        }
    }

    const generateFolder = ({ name, icon, color }, isOpen) => {
        return <DListItem backgroundColor={color} ><Flex verticalAlign={'center'} width={'300px'}> {(icon ? <Box style={{ marginRight: "15px", marginTop: "3px" }} ><DynamicIcon iconName={icon} /></Box> : <FaFolder style={{ marginRight: "15px", marginTop: "3px" }} />)}{name}</Flex></DListItem>;
    }

    const renderTree = (treeItems, items) => {
        if (!treeItems || items.length === 0)
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

                    if (!item.isFolder && !foundItem.name.includes(filterRef.current)) {
                        item = item.nextInstance;
                        continue;
                    }

                    if (!item.isFolder && additionalFilter && !additionalFilter(foundItem) ) {
                        item = item.nextInstance;
                        continue;
                    }

                    array.push({ ...item, icon: undefined, itemIcon: item.icon, children, label: item.isFolder ? generateFolder(item) : generateItem(foundItem, item), itemRef: foundItem, open: openStates[item.id], path: path });
                }
                else {
                    const foundItem = items.find(x => x.id === item.targetId);

                    if (!item.isFolder && !foundItem.name.includes(filterRef.current)) {
                        item = item.nextInstance;
                        continue;
                    }

                    if (!item.isFolder && additionalFilter && !additionalFilter(foundItem) )
                    {
                        item = item.nextInstance;
                        continue;
                    }

                    array.push({ ...item, icon: undefined, itemIcon: item.icon, label: item.isFolder ? generateFolder(item) : generateItem(foundItem, item), itemRef: foundItem, open: openStates[item.id], path: path });
                }
                item = item.nextInstance;
            }
        }

        addArray(firstElement, data, path);

        setTreeData(data);
    }

    return (
        <Flex direction='column'>
            <Subscribable commandPrefix={"tree_"} onMessage={HandleMessage} />
            <Input size={'xs'} placeholder="Search" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <ReactTreeList ref={treeComponentRef} itemDefaults={{ arrow: "▸" }} data={treeData}
                draggable={false}
                onDrop={(e) => { 
                    e.allowDropInside = false; 
                    e.allowChildren = false;
                    e.allowDrop = false;
                    
                    renderTree(treeItems, items); }}
                

                onSelected={(s) => {
                    setSelectedItem(s);
                    onSelect && onSelect(s);
                }} onChange={handleChange} />
        </Flex>
    );
}
export default DTreeViewOnly;