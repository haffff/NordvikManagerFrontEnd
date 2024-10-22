import * as React from 'react';
import * as Dockable from "@hlorenzi/react-dockable"
import SettingsPanel from './SettingsPanel';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@chakra-ui/react'
import CommandFactory from '../../BattleMap/Factories/CommandFactory';
import WebSocketManagerInstance from '../WebSocketManager';
import Subscribable from '../../uiComponents/base/Subscribable';
import SecuritySettingsPanel from './SecuritySettingsPanel';
import BasePanel from '../../uiComponents/base/BasePanel';
import PropertiesSettingsPanel from './PropertiesSettingsPanel';
import { SettingsPanelWithPropertySettings } from './SettingsPanelWithPropertySettings';
import useGame from '../../uiComponents/hooks/useGameHook';

export const MapSettingsPanel = ({ map }) => {

    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    const editables = [
        { key: "name", label: "Name", toolTip: "Name of map.", type: "string" },
        { key: "width", label: "Map Width", toolTip: "", min: 100, type: "number" },
        { key: "height", label: "Map Height", toolTip: "", min: 100, type: "number" },
        { key: "gridSize", label: "Size of Grid", toolTip: "", min: 10, type: "number" },
        { key: "gridVisible", label: "Is Grid Visible", toolTip: "", type: "boolean" },

        { key: "useCustomUnits", property: true, label: "Use different unit system", toolTip: "Image of game shown in game list menu for other players.", type: "boolean", category: "Units" },
        { key: "useSquaredSystem", property: true, disableOn: (dto) => dto?.useCustomUnits !== true, label: "Use realistic distance system", toolTip: "Image of game shown in game list menu for other players.", type: "boolean", category: "Units" },
        { key: "baseDistancePerSquare", property: true, disableOn: (dto) => dto?.useCustomUnits !== true, min: 1, label: "Default distance per square", toolTip: "Image of game shown in game list menu for other players.", type: "number", category: "Units" },
        { key: "baseDistanceUnit", property: true, disableOn: (dto) => dto?.useCustomUnits !== true, label: "Default distance unit", toolTip: "Image of game shown in game list menu for other players.", type: "string", category: "Units" },
        //{key: "password", label:"Password:", toolTip:"Password that other players need to know to join the game.", type:"string"}
    ] 

    const gameData = useGame();

    const ctx = Dockable.useContentContext();

    if (!map || !gameData) {
        ctx.setTitle(`Map Settings - Empty`);
        return <></>;
    }
    else {
        ctx.setTitle(`Map Settings - ${map.name}`);
    }

    const sendSettingsUpdate = (dtoToSend) => {
        let dtoToSave = structuredClone(map);
        Object.keys(dtoToSend).forEach(key => {
            dtoToSave[key] = dtoToSend[key];
        });

        dtoToSave.elements = undefined;

        let command = CommandFactory.CreateMapSettingsCommand(dtoToSave);
        WebSocketManagerInstance.Send(command);
    }

    const updateSettings = (event) => {
        let gameMap = gameData.maps.filter(x => x.id === event.data.id)[0];
        map.name = event.data.name;
        gameMap.name = event.data.name;
        forceUpdate();
    }

    return (
        <Subscribable commandPrefix={"settings_map"} onMessage={updateSettings}>
            <BasePanel>
                <Tabs marginTop={3} size='md' variant='enclosed'>
                    <TabList>
                        <Tab>Settings</Tab>
                        <Tab>Permissions</Tab>
                        <Tab>Properties</Tab>
                    </TabList>
                    <TabPanels>
                        <TabPanel>
                            <SettingsPanelWithPropertySettings entityName={"MapModel"} dto={map} editableKeyLabelDict={editables} onSave={sendSettingsUpdate} />
                        </TabPanel>
                        <TabPanel>
                            <SecuritySettingsPanel dto={map} type="MapModel" />
                        </TabPanel>
                        <TabPanel>
                            <PropertiesSettingsPanel dto={map} type="MapModel" />
                        </TabPanel>
                    </TabPanels>
                </Tabs>
            </BasePanel>
        </Subscribable>
    );
}
export default MapSettingsPanel;