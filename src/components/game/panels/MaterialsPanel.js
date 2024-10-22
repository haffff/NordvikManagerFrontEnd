import * as React from 'react';
import { Flex, Circle, FormLabel, Box, Popover, PopoverTrigger, Portal, PopoverContent, PopoverCloseButton, PopoverBody, Image, Divider, useToast } from '@chakra-ui/react'
import * as Dockable from "@hlorenzi/react-dockable"
import DList from '../../uiComponents/base/List/DList';
import DListItem from '../../uiComponents/base/List/DListItem';
import DListItemsButtonContainer from '../../uiComponents/base/List/DListItemsButtonContainer';
import DLabel from '../../uiComponents/base/Text/DLabel';
import WebHelper from '../../../helpers/WebHelper';
import BasePanel from '../../uiComponents/base/BasePanel';
import DContainer from '../../uiComponents/base/Containers/DContainer';
import DListItemButton from '../../uiComponents/base/List/ListItemDetails/DListItemButton';
import { FaCode, FaEdit, FaEye, FaFontAwesome, FaICursor, FaLink, FaMinusCircle, FaMusic, FaPen, FaShare } from 'react-icons/fa';
import UtilityHelper from '../../../helpers/UtilityHelper';
import DTreeList from '../../uiComponents/treeList/DTreeList';
import CollectionSyncer from '../../uiComponents/base/CollectionSyncer';
import InputModal from '../../uiComponents/base/Modals/InputModal';
import WebSocketManagerInstance from '../WebSocketManager';
import Subscribable from '../../uiComponents/base/Subscribable';
import RefreshInfo from '../../uiComponents/treeList/RefreshInfoCard';
import DockableHelper from '../../../helpers/DockableHelper';
import LookupPanel from './Addons/LookupPanel';

export const MaterialsPanel = ({ state }) => {
    const [resources, setResources] = React.useState([]);
    const [ignoreRefresh, setIgnoreRefresh] = React.useState(false);
    const toast = useToast();
    const inputFile = React.useRef(null);

    const LoadData = () => {
        WebHelper.get("materials/getresources", (response) => {
            setResources(response);
        }, (error) => console.log(error));
    }

    React.useEffect(() => {
        LoadData();
    }, []);

    const onFolderRenameOpenRef = React.useRef(null);
    const HandleDrop = (ev) => {
        ev.preventDefault();
        setIgnoreRefresh(true);

        const doneArr = {};

        [...ev.dataTransfer.items].forEach((item, i) => {
            if (item.kind === "file") {
                doneArr[i] = false;
                WebHelper.postMaterial(item.getAsFile(), "", (result) => {
                    doneArr[i] = true;
                    if (Object.values(doneArr).every(x => x)) {
                        setIgnoreRefresh(false);
                        LoadData();
                    }
                }, (error) => { console.error(error) });
            }
        });
    }

    const GetLink = (id) => {
        return `${WebHelper.ApiAddress}/Materials/Resource?id=${id}`;
    }

    const GenerateLink = (id) => {
        let url = GetLink(id);
        if (navigator.clipboard) {
            navigator.clipboard.writeText(url);
            toast(UtilityHelper.GenerateCopiedToast());
        }
        else {
            window.prompt("Copy to clipboard: Ctrl+C, Enter", url);
        }
    }

    const HandleAdd = (ev) => {
    }

    const ctx = Dockable.useContentContext();
    ctx.setTitle(`Materials`);

    const GetItemBody = (item) => {
        const getTextDockable = (item) => {
            WebHelper.getMaterial(item.id, item.mimeType, (result) => {
                return DockableHelper.NewFloating(state, <LookupPanel
                    name={item.name}
                    content={result}
                    contentType={item?.mimeType}
                />);
            }, (error) => { console.error(error) });
        };

        const getDockable = (item) => {
            return DockableHelper.NewFloating(state, <LookupPanel
                name={item.name}
                content={GetLink(item.id)}
                contentType={item?.mimeType}
                isUrl={true}
            />);
        }

        //Image
        if (item?.mimeType.startsWith("image")){
            return (
                <>
                    {/* <Popover closeOnBlur={true} placement='left-end'> */}
                    {/* <PopoverTrigger> */}
                    <Image objectFit={'contain'} boxSize={'50px'} onClick={() => getDockable(item)} src={GetLink(item.id)} />
                    {/* </PopoverTrigger>
                        <PopoverContent>
                            <PopoverCloseButton />
                            <PopoverBody>
                                <Image objectFit={'contain'} boxSize={'250px'} v src={GetLink(item.id)} />
                            </PopoverBody>
                        </PopoverContent> */}
                    {/* </Popover> */}
                    <DLabel>{item.name}</DLabel>
                </>
            );
        }

        //Music
        if (item?.mimeType.startsWith("audio")) {
            return (
                <>
                    <FaMusic size={30} onClick={() => getDockable(item)} /><DLabel>{item.name}
                    </DLabel>
                </>
            );
        }

        //CODE
        if (item?.mimeType.startsWith("text") || item?.mimeType.startsWith("application")) {
            return (
                <>
                    <FaCode onClick={() => getTextDockable(item)} size={30} />
                    <DLabel>{item.name}</DLabel>
                </>
            );
        }

    };

    return (
        <BasePanel>
            <Subscribable commandPrefix={"resource_notify"} onMessage={() => { }} />
            <InputModal
                title={"Rename Resource"}
                getConfigDict={() => [{ key: "name", label: "Resource Name", toolTip: "Name of Resource.", type: "string", required: true }]}
                openRef={onFolderRenameOpenRef}
                onCloseModal={({ name, id }, success) => { if (success) { WebSocketManagerInstance.Send({ command: `resource_update`, data: { id, name } }) } }} />
            <DContainer height={'100%'}>
                <CollectionSyncer incrementalUpdate={true} collection={resources} setCollection={setResources} commandPrefix={"resource"} />
                <DLabel>Resources</DLabel>
                <DList >
                    <RefreshInfo commandPrefix={"resource_notify"} ignore={ignoreRefresh} onRefresh={() => { LoadData(); }} />
                    <DTreeList items={resources}
                        onGenerateEditButtons={(item) => {
                            return <>
                                <DListItemButton icon={FaLink} label={"Get Link"} onClick={() => GenerateLink(item.id)} />
                                <DListItemButton icon={FaPen} label={"Rename resource"} onClick={() => { onFolderRenameOpenRef.current({ name: item.name, id: item.id }) }} />
                                <DListItemButton icon={FaMinusCircle} color={'red'} label={'Delete'} onClick={() => { WebSocketManagerInstance.Send({ command: `resource_delete`, data: item.id }) }} />
                            </>
                        }}
                        generateItem={(item) => {
                            const itemBody = GetItemBody(item) || <DLabel>{item.name}</DLabel>;
                            return <DListItem drag width='300px'>
                                {itemBody}
                            </DListItem>;
                        }}
                        entityType={"ResourceModel"} />
                </DList>
            </DContainer>
            <Box>
                <Box onDragOver={(ev) => ev.preventDefault()} onDrop={(ev) => { ev.preventDefault(); HandleDrop(ev); }} onClick={() => { inputFile.current.click() }} width={'200px'} height={'100px'} borderWidth={'2px'} borderRadius={'10px'} borderStyle={'dashed'} alignContent={'center'} textAlign={'center'}>Drop here</Box>
                <input type='file' id='file' ref={inputFile} onChange={(e) => HandleAdd(e.target.files[0])} style={{ display: 'none' }} />
            </Box>
        </BasePanel>
    )
}
export default MaterialsPanel;