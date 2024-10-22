import * as React from 'react';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@chakra-ui/react'
import { HStack, Button, Box, Stack, Divider, Textarea, Grid, GridItem, Flex, Card, CardHeader, CardBody, Heading, Center, Badge, FormLabel, Input, Checkbox, NumberInput, NumberInputField } from '@chakra-ui/react'
import * as Dockable from "@hlorenzi/react-dockable"
import WebSocketManagerInstance from '../WebSocketManager';
import SettingsPanel from './SettingsPanel';
import CommandFactory from '../../BattleMap/Factories/CommandFactory';
import Subscribable from '../../uiComponents/base/Subscribable';
import SecuritySettingsPanel from './SecuritySettingsPanel';
import BasePanel from '../../uiComponents/base/BasePanel';
import useGame from '../../uiComponents/hooks/useGameHook';

export const LayoutSettingsPanel = ({ layout }) => {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    const game = useGame();

    const editables = [
        { key: "name", label: "Name", toolTip: "Name of layout.", type: "string" },
        { key: "visibleToOnly", label: "Visible to only", toolTip: "If set only selected players can see this layout.", type: "playerArray" },
        { key: "default", label: "Is default", toolTip: "Default layout", type: "boolean" },
    ]

    const ctx = Dockable.useContentContext();

    if (layout === undefined) {
        ctx.setTitle(`Layout Settings - Empty`);
        return <></>;
    }
    else {
        ctx.setTitle(`Layout Settings - ${layout.name}`);
    }

    const sendSettingsUpdate = (dtoToSend) => {
        dtoToSend.id = layout.id;
        dtoToSend.gameModelId = layout.gameModelId;
        let command = CommandFactory.CreateLayoutUpdateCommand(dtoToSend);
        WebSocketManagerInstance.Send(command);
    }

    const updateSettings = (event) => {
        let layout = game.layouts.filter(x => x.id == event.data.id)[0];
        if (layout !== undefined) {
            layout.name = event.data.name;
            forceUpdate();
        }
    }

    return (
        <Subscribable commandPrefix={"layout_update"} onMessage={updateSettings}>
            <BasePanel>
                <Tabs marginTop={3} size='md' variant='enclosed'>
                    <TabList>
                        <Tab>Settings</Tab>
                        <Tab>Permissions</Tab>
                    </TabList>
                    <TabPanels>
                        <TabPanel>
                            <SettingsPanel dto={layout} editableKeyLabelDict={editables} onSave={sendSettingsUpdate} />
                        </TabPanel>
                        <TabPanel>
                            <SecuritySettingsPanel dto={layout} type="LayoutModel" />
                        </TabPanel>
                    </TabPanels>
                </Tabs>
            </BasePanel>
        </Subscribable>
    );
}
export default LayoutSettingsPanel;