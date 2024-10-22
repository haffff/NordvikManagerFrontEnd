import * as React from 'react';
import { TabPanels, Tabs, TabList, Tab, TabPanel, Box, Input, Button, Checkbox, Flex, useToast } from '@chakra-ui/react'
import * as Dockable from "@hlorenzi/react-dockable"
import WebHelper from '../../../../helpers/WebHelper';
import BasePanel from '../../../uiComponents/base/BasePanel';
import DContainer from '../../../uiComponents/base/Containers/DContainer';
import DListItem from '../../../uiComponents/base/List/DListItem';
import DListItemsButtonContainer from '../../../uiComponents/base/List/DListItemsButtonContainer';
import DListItemButton from '../../../uiComponents/base/List/ListItemDetails/DListItemButton';
import { FaDumpster, FaMinus } from 'react-icons/fa';
import DLabel from '../../../uiComponents/base/Text/DLabel';
import UtilityHelper from '../../../../helpers/UtilityHelper';

export const AddonsManagePanel = ({ state, gameDataRef }) => {
    const forceUpdate = React.useReducer(x => x + 1, 0)[1];
    const [addons, setAddons] = React.useState([]);
    const [panels, setPanels] = React.useState([]);
    const [actions, setActions] = React.useState([]);
    const [prefix, setPrefix] = React.useState("");
    const [name, setName] = React.useState("");
    const [createAddon, setCreateAddon] = React.useState({});//{name, description, version, author, url, actions, views}
    const [filteredActions, setFilteredActions] = React.useState([...actions]);

    const toast = useToast();

    const inputFile = React.useRef(null);
    React.useEffect(() => {
        HandleReload();
    }, []);

    const HandleReload = () => {
        WebHelper.get("addon/addons?gameid=" + gameDataRef.current?.Game?.id, (response) => { setAddons(response) }, (error) => console.log(error));
        WebHelper.get("addon/customPanels?gameid=" + gameDataRef.current?.Game?.id, (response) => { setPanels(response) }, (error) => console.log(error));
        WebHelper.get("addon/actions?gameid=" + gameDataRef.current?.Game?.id, (response) => { setActions(response) }, (error) => console.log(error));
    }

    const Install = (file) => {
        if (file) {
            var reader = new FileReader();
            reader.onload = function (e) {
                var data = e.target.result;
                var addon = JSON.parse(data);
                WebHelper.post("addon/install?gameId=" + gameDataRef.current?.Game?.id, { ...addon }, (response) => {
                    HandleReload();
                    toast({
                        title: 'Addon installed!',
                        status: 'success',
                        duration: 9000,
                        isClosable: true
                    });
                }, (error) => 
                toast({
                    title: 'Something went wrong!',
                    status: 'error',
                    duration: 9000,
                    isClosable: true
                })
            );
            }
            reader.readAsText(file);
        }
    }

    const HandleDrop = (ev) => {
        if (ev.dataTransfer.items) {
            var file = [...ev.dataTransfer.items].find(x => x.kind === 'file').getAsFile();
            if (file) {
                Install(file);
            }
        }
    }

    const ctx = Dockable.useContentContext();
    ctx.setTitle(`Addons Manage Panel`);

    return (
        <BasePanel>
            <Tabs>
                <TabList>
                    <Tab>Installed</Tab>
                    <Tab>Install</Tab>
                    <Tab>Create</Tab>
                </TabList>
                <TabPanels>
                    <TabPanel>
                        {addons.map((addon) => {
                            return <DListItem><p style={{ padding: '3px', paddingRight: '15px' }}>{addon.name}</p> <i style={{ color: "rgb(100,100,100)" }}>{addon.description}</i>
                                <DListItemsButtonContainer>
                                    <DListItemButton label={"Uninstall"} icon={FaMinus} onClick={() => { WebHelper.post("addon/uninstall", { gameId: gameDataRef.current?.Game?.id, addonId: addon.id }, HandleReload) }} />
                                </DListItemsButtonContainer>
                            </DListItem>;
                        })}
                    </TabPanel>
                    <TabPanel>
                        Drop addon file here:
                        <Box onDragOver={(ev) => ev.preventDefault()} onDrop={(ev) => { ev.preventDefault(); HandleDrop(ev); }} onClick={() => { inputFile.current.click() }} width={'200px'} height={'100px'} borderWidth={'2px'} borderRadius={'10px'} borderStyle={'dashed'} alignContent={'center'} textAlign={'center'}>Drop here</Box>
                        <input type='file' id='file' ref={inputFile} onChange={(e) => Install(e.target.files[0])} style={{ display: 'none' }} />
                        Or provide URL:
                        <Input placeholder="Addon URL" />
                        <Button>Install</Button>
                    </TabPanel>
                    <TabPanel>
                        <DContainer title={"Information"} withVisibilityToggle >
                            <DLabel>Name</DLabel>
                            <Input placeholder="Addon Name" onChange={(e) => setCreateAddon({ ...createAddon, Name: e.target.value })} />
                            <DLabel>Description</DLabel>
                            <Input placeholder="Addon Description" onChange={(e) => setCreateAddon({ ...createAddon, Description: e.target.value })} />
                            <DLabel>Version</DLabel>
                            <Input placeholder="Addon Version" onChange={(e) => setCreateAddon({ ...createAddon, Version: e.target.value })} />
                            <DLabel>Author</DLabel>
                            <Input placeholder="Addon Author" onChange={(e) => setCreateAddon({ ...createAddon, Author: e.target.value })} />
                            <DLabel>Website</DLabel>
                            <Input placeholder="Addon URL" onChange={(e) => setCreateAddon({ ...createAddon, Website: e.target.value })} />
                            <DLabel>License</DLabel>
                            <Input placeholder="Addon License" onChange={(e) => setCreateAddon({ ...createAddon, License: e.target.value })} />
                        </DContainer>
                        <DContainer maxHeight={'300px'} title={"Actions"} withVisibilityToggle >
                            <Flex>
                                <Input placeholder="Prefix" onChange={(e) => { setPrefix(e.target.value) }} width={'200px'} />
                                <Input placeholder="Name" onChange={(e) => { setName(e.target.value) }} />
                                <Button onClick={() => { actions.filter(x => x.prefix.includes(prefix) && x.name.includes(name)).forEach(x => x.selected = true); forceUpdate() }}>Select</Button>
                                <Button onClick={() => { actions.filter(x => x.prefix.includes(prefix) && x.name.includes(name)).forEach(x => x.selected = false); forceUpdate() }}>Deselect</Button>
                            </Flex>

                            {actions.filter(x => x.prefix.includes(prefix) && x.name.includes(name)).map((action, index) => (<DListItem key={action.id + action.selected}><Checkbox defaultChecked={action.selected} onChange={(e) => { action.selected = e.target.checked; forceUpdate() }} style={{ paddingRight: '25px' }}>{action.name}</Checkbox> <i style={{ color: "rgb(100,100,100)" }}>{action.description}</i></DListItem>))}
                            {<div>Selected {actions.filter(x => x.selected).length} actions.</div>}
                        </DContainer>
                        <DContainer maxHeight={'300px'} title={"Views"} withVisibilityToggle >
                            {panels.map((panel, index) => (<DListItem key={panel.id + panel.selected}><Checkbox onChange={(e) => { panel.selected = e.target.checked; forceUpdate() }} defaultChecked={panel.selected} style={{ paddingRight: '25px' }}>{panel.name}</Checkbox> <i style={{ color: "rgb(100,100,100)" }}>{panel.description}</i></DListItem>))}
                            {<div>Selected {panels.filter(x => x.selected).length} views.</div>}
                        </DContainer>
                        <Button onClick={
                            () => {
                                createAddon.GameId = gameDataRef.current?.Game?.id;
                                createAddon.Actions = actions.filter(x => x.selected).map(x => x.id);
                                createAddon.Views = panels.filter(x => x.selected).map(x => x.id);
                                createAddon.Resources = [];
                                WebHelper.post("addon/createaddon", { ...createAddon }, (response) => { UtilityHelper.DownloadObjectAsFile(response, createAddon.Name) }, (error) => console.log(error));
                            }}>Create</Button>
                        <Button onClick={HandleReload}>Reload</Button>
                    </TabPanel>
                </TabPanels>
            </Tabs>
        </BasePanel>
    )
}
export default AddonsManagePanel;