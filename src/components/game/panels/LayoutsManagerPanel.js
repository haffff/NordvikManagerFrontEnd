import * as React from 'react';
import { HStack, Button, Box, Flex, Card, CardHeader, CardBody, Heading, Center, Badge, Checkbox, RadioGroup, Radio, useRadio, useRadioGroup, Stack, Switch, GridItem, Grid, Icon, IconButton, Accordion, AccordionItem, AccordionButton, AccordionIcon, AccordionPanel, Tooltip } from '@chakra-ui/react'
import * as Dockable from "@hlorenzi/react-dockable"
import { FaCheck, FaEye, FaPlus, FaRemoveFormat, FaUserFriends, FaWrench, FaXbox } from 'react-icons/fa';
import Subscribable from '../../uiComponents/base/Subscribable';
import { IoIosRemoveCircleOutline, IoMdRemove } from 'react-icons/io';
import LayoutSettingsPanel from '../settings/LayoutSettingsPanel';
import CommandFactory from '../../BattleMap/Factories/CommandFactory';
import WebSocketManagerInstance from '../WebSocketManager';
import BasePanel from '../../uiComponents/base/BasePanel';
import DListItem from '../../uiComponents/base/List/DListItem';
import DListItemButton from '../../uiComponents/base/List/ListItemDetails/DListItemButton';
import ClientMediator from '../../../ClientMediator';
import WebHelper from '../../../helpers/WebHelper';
import CollectionSyncer from '../../uiComponents/base/CollectionSyncer';

export const LayoutsManagerPanel = ({ state }) => {

    const [clientLayouts, setClientLayouts] = React.useState(undefined);
    const [serverLayouts, setServerLayouts] = React.useState(undefined);
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    const [selectedLayout, setSelectedLayout] = React.useState(ClientMediator.sendCommand("Game", "GetLayout", {}));

    React.useEffect(() => {
        WebHelper.get("Battlemap/GetLayouts", setServerLayouts);
    }, []);

    if (clientLayouts === undefined) {

        let layouts = localStorage.getItem("Layouts");
        if (!layouts) {
            layouts = "[]";
        }

        let layoutArr = JSON.parse(layouts);


        setClientLayouts(layoutArr);
    }

    const GenerateServerLayouts = () => {
        if(serverLayouts === undefined)
        {
            return [];
        }

        let layouts = serverLayouts.map(x => {
            return (
                <DListItem isSelected={selectedLayout === x}>
                    <Flex>
                        {x.name}
                        <Flex direction={'row-reverse'} flexGrow={1}>
                            <DListItemButton label='Remove' color={'red'} icon={IoIosRemoveCircleOutline} onClick={() => {
                                let cmd = CommandFactory.CreateLayoutRemoveCommand(x.id);
                                WebSocketManagerInstance.Send(cmd);
                            }} />
                            <DListItemButton label='Settings' icon={FaWrench} onClick={
                                () => { Dockable.spawnFloating(state, (<LayoutSettingsPanel layout={x} />)) }}
                                colorScheme='alpha'
                            />
                            <DListItemButton label='Apply this layout' icon={FaCheck} onClick={() => { ClientMediator.sendCommand("Game", "SetLayout", x) }} />
                            <DListItemButton label='Force onto other players' icon={FaUserFriends} onClick={() => {
                                let cmd = CommandFactory.CreateLayoutForceCommand(x.id);
                                WebSocketManagerInstance.Send(cmd);
                            }} />
                        </Flex>
                    </Flex>
                </DListItem>
            );
        });
        return layouts;
    };

    const GenerateClientLayouts = () => {
        if (clientLayouts === undefined) {
            return [];
        }

        let layouts = clientLayouts.map(x => {
            return (
                <Card style={{ backgroundColor: 'rgba(50,50,50,50.5)', color: 'white' }} colorScheme="blackAlpha" variant="elevated" padding={3} margin={1} size='sm' width="97%">
                    <Flex>
                        {x.name}
                        <Flex direction={'row-reverse'} flexGrow={1}>
                            <Tooltip openDelay={300} label='Remove' fontSize='md'>
                                <IconButton onClick={() => {
                                    let layouts = localStorage.getItem("Layouts");
                                    let layoutArr = JSON.parse(layouts);
                                    let newArr = layoutArr.filter(y => y.uuid !== x.uuid);
                                    localStorage.setItem("Layouts", JSON.stringify(newArr));
                                    setClientLayouts(newArr);
                                }} colorScheme='alpha' color={'red'} icon={<Icon as={IoIosRemoveCircleOutline} />}></IconButton>
                            </Tooltip>
                            {/* <Tooltip openDelay={300} label='Settings' fontSize='md'>
                                <IconButton onClick={() => { }} colorScheme='alpha' icon={<Icon as={FaWrench} />}></IconButton>
                            </Tooltip> */}
                            <Tooltip openDelay={300} label='Apply this layout' fontSize='md'>
                                <IconButton onClick={() => { ClientMediator.sendCommand("Game", "SetLayout", x) }} colorScheme='alpha' icon={<Icon as={FaCheck} />}></IconButton>
                            </Tooltip>
                        </Flex>
                    </Flex>
                </Card>
            );
        });
        return layouts;
    };

    const ctx = Dockable.useContentContext();
    ctx.setTitle(`Layouts Manager`);

    const HandleMessage = (response) => {
        switch (response.command) {
            case "layout_add":
                forceUpdate();
                break;
            case "layout_remove":
                forceUpdate();
                break;
        }
    }

    return (
        <BasePanel>
            <Subscribable commandPrefix={"layout"} onMessage={HandleMessage}>
                <Accordion defaultIndex={[0]} allowMultiple>
                    <AccordionItem>
                        <h2>
                            <AccordionButton>
                                <Box as="span" flex='1' textAlign='left'>
                                    Game layouts
                                </Box>
                                <AccordionIcon />
                            </AccordionButton>
                        </h2>
                        <AccordionPanel pb={4}>
                            {GenerateServerLayouts()}
                        </AccordionPanel>
                    </AccordionItem>

                    <AccordionItem>
                        <h2>
                            <AccordionButton>
                                <Box as="span" flex='1' textAlign='left'>
                                    Browser Layouts
                                </Box>
                                <AccordionIcon />
                            </AccordionButton>
                        </h2>
                        <AccordionPanel pb={4}>
                            {GenerateClientLayouts()}
                        </AccordionPanel>
                    </AccordionItem>
                </Accordion>
            </Subscribable>
            <CollectionSyncer collection={serverLayouts} setCollection={setServerLayouts} commandPrefix={"layout"} />
        </BasePanel>
    )
}
export default LayoutsManagerPanel;