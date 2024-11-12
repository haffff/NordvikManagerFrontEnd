import * as React from 'react';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@chakra-ui/react'
import * as Dockable from "@hlorenzi/react-dockable"
import WebSocketManagerInstance from '../WebSocketManager';
import SettingsPanel from './SettingsPanel';
import CommandFactory from '../../BattleMap/Factories/CommandFactory';
import Subscribable from '../../uiComponents/base/Subscribable';
import SecuritySettingsPanel from './SecuritySettingsPanel';
import PropertiesSettingsPanel from './PropertiesSettingsPanel';
import BasePanel from '../../uiComponents/base/BasePanel';
import EditTable from './EditTable';
import { SettingsPanelWithPropertySettings } from './SettingsPanelWithPropertySettings';
import WebHelper from '../../../helpers/WebHelper';

export const CardSettingsPanel = ({ gameDataManagerRef, cardId }) => {
    const [dto, setDto] = React.useState(undefined);
    const [templates, setTemplates] = React.useState([]);

    const generalSettings = [
        { key: "name", label: "Card name", toolTip: "Card name.", type: "string", required: true },
        { key: "character_name", label: "Character name", toolTip: "Name of character", type: "string", required: false, property: true },
        { key: "player_owner", label: "Player owner", toolTip: "Player owner", type: "playerSelect", required: false, property: true },
    ];

    const tokenEditables = [
        { key: "tokenImage", label: "Token Image", type: "image", required: false },
        { key: "token", label: "Token", toolTip: ".", type: "materialSelect", additionalFilter: (foundItem) => foundItem.mimeType === "application/json", property: true  },
        { key: "drop_token_size", label: "Token Size", type: "number", min: 1, max: 20, property: true },
    ];

    let gameData = gameDataManagerRef.current;
    const ctx = Dockable.useContentContext();

    React.useEffect(() => {
        if (cardId === undefined) {
            return;
        }
        WebHelper.get("materials/getcard?gameid=" + gameDataManagerRef.current.Game.id + "&id=" + cardId, (response) => {
            setDto(response);
            ctx.setTitle(`Card Settings - ${response.name}`);
        }, (error) => console.log(error));

    }, [cardId]);
    
    if (dto === undefined) {
        return <></>;
    }


    const sendSettingsUpdate = (dtoToSend) => {
        let dtoToSave = structuredClone(dto);
        Object.keys(dtoToSend).forEach(key => {
            dtoToSave[key] = dtoToSend[key];
        });

        let command = CommandFactory.CreateGameSettingsCommand(dtoToSave);
        WebSocketManagerInstance.Send(command);
    }

    const updateSettings = (event) => {
        gameData.Game.name = event.data.name;
    }

    return (
        <Subscribable commandPrefix={"settings_card"} onMessage={updateSettings}>
            <BasePanel>
                <Tabs marginTop={3} size='md' variant='enclosed'>
                    <TabList>
                        <Tab>General</Tab>
                        <Tab>Token Settings</Tab>
                        <Tab>Permissions</Tab>
                        <Tab>Properties</Tab>
                    </TabList>
                    <TabPanels>
                    <TabPanel>
                            <SettingsPanelWithPropertySettings gameDataManagerRef={gameDataManagerRef} dto={dto} entityName={"CardModel"} editableKeyLabelDict={generalSettings} />
                        </TabPanel>
                        <TabPanel>
                            <SettingsPanelWithPropertySettings gameDataManagerRef={gameDataManagerRef} dto={dto} entityName={"CardModel"} editableKeyLabelDict={tokenEditables} />
                        </TabPanel>
                        <TabPanel>
                            <SecuritySettingsPanel gameDataManagerRef={gameDataManagerRef} dto={dto} type="CardModel" />
                        </TabPanel>
                        <TabPanel>
                            <PropertiesSettingsPanel gameId={gameDataManagerRef.current.Game.id} dto={dto} type="CardModel" />
                        </TabPanel>
                    </TabPanels>
                </Tabs>
            </BasePanel>
        </Subscribable>
    );
}

export default CardSettingsPanel;