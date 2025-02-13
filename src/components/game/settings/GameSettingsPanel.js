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
import useGame from '../../uiComponents/hooks/useGameHook';

export const GameSettingsPanel = () => {

    const [templates, setTemplates] = React.useState([]);

    const editables = [
        { key: "name", label: "Name of game", toolTip: "Name of game shown in game list menu for other players.", type: "string", category: "General", required: true },
        { key: "color", property:true, label: "Color of game", toolTip: "Color of game shown in game list menu for other players.", type: "color", category: "General" },
        { key: "image", property:true, label: "Image of game", toolTip: "Image of game shown in game list menu for other players.", type: "image", category: "General" },
        { key: "longDescription", property:true,  label: "Description of game", toolTip: "Description of game details for other players.", type: "textarea", category: "General" },
        { key: "shortDescription", property:true,  label: "Summary of game", toolTip: "Summary of game shown in game list menu for other players.", type: "textarea", category: "General" },
        { key: "allowPlayerUseLayouts",property:true,  label: "Allow player use local layouts", toolTip: "Players can modify look of the game to their liking.", type: "boolean", category: "General" },
        //{key: "password", label:"Password:", toolTip:"Password that other players need to know to join the game.", type:"string"}
    ]

    const battleMapEditables = [
        { key: "additionalLayers", label: "Additional Layers", toolTip: "Image of game shown in game list menu for other players.", type: "boolean", category: "Layers" },

        { key: "useSquaredSystem", property: true, label: "Use realistic distance system", toolTip: "Image of game shown in game list menu for other players.", type: "boolean", category: "Units" },
        { key: "baseDistancePerSquare", property: true, min: 1, label: "Default distance per square", toolTip: "Image of game shown in game list menu for other players.", type: "number", category: "Units" },
        { key: "baseDistanceUnit", property: true, label: "Default distance unit", toolTip: "Image of game shown in game list menu for other players.", type: "string", category: "Units" },
    ]

    const characterSheetEditables = [
        { key: "useDefaultCharacterSheets", property: true, label: "Add default Character sheet to player", toolTip: ".", type: "boolean", category: "Character Sheets" },
        {
            key: "characterSheetTemplate", property: true, label: "Character sheet template", toolTip: "Image of game shown in game list menu for other players.", type: "select", options:
                [{label: "None"}, ...templates.map(x => { return { value: x.id, label: x.name } })], category: "Character Sheets", 
                validate: (value, dto) => { 
                    var isSuccess = !(dto.useDefaultCharacterSheets === true && value === undefined);
                    return { success: isSuccess, message: "You need to select a template" };
                }
        },
        { key : "defaultToken", property: true, label: "Default Token", additionalFilter: (foundItem) => foundItem.mimeType === "application/json" ,toolTip: "Image of game shown in game list menu for other players.", type: "materialSelect", category: "Character Sheets" },
    ];

    const advancedEditables = [
        { key: "untrustedClientScripts", property: true, label: "Use client scripts from not trusted source (Game will be marked as unsafe)", toolTip: "", type: "boolean" },
    ];

    let gameData = useGame();

    const ctx = Dockable.useContentContext();
    ctx.setTitle(`Game Settings`);

    React.useEffect(() => {
        if (gameData?.id === undefined) {
            return;
        }
        WebHelper.get("materials/gettemplatesfull?gameId=" + gameData.id, setTemplates);

    }, [gameData]);
    let dto = gameData;
    
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
        gameData.name = event.data.name;
    }

    return (
        <Subscribable commandPrefix={"settings_game"} onMessage={updateSettings}>
            <BasePanel>
                <Tabs.Root defaultValue={"settings"}  lazyMount size='md' variant='enclosed'>
                    <Tabs.List>
                        <Tabs.Trigger value='general'>General Settings</Tabs.Trigger>
                        <Tabs.Trigger value='grid'>Grid Settings</Tabs.Trigger>
                        <Tabs.Trigger value='character'>Character Sheets</Tabs.Trigger>
                        <Tabs.Trigger value='permissions'>Permissions</Tabs.Trigger>
                        <Tabs.Trigger value='props'>Properties</Tabs.Trigger>
                        <Tabs.Trigger value='adv'>Advanced</Tabs.Trigger>
                    </Tabs.List>
                        <Tabs.Content value='general'>
                            <SettingsPanelWithPropertySettings dto={dto} entityName={"GameModel"}  editableKeyLabelDict={editables} onSave={sendSettingsUpdate} />
                        </Tabs.Content>
                        <Tabs.Content value='grid'>
                            <SettingsPanelWithPropertySettings dto={dto} entityName={"GameModel"} editableKeyLabelDict={battleMapEditables} />
                        </Tabs.Content>
                        <Tabs.Content value='character'>
                            <SettingsPanelWithPropertySettings dto={dto} entityName={"GameModel"} editableKeyLabelDict={characterSheetEditables} />
                        </Tabs.Content>
                        <Tabs.Content value='permissions'>
                            <SecuritySettingsPanel dto={dto} type="GameModel" />
                        </Tabs.Content>
                        <Tabs.Content value='props'>
                            <PropertiesSettingsPanel gameId={gameData.id} dto={dto} type="GameModel" />
                        </Tabs.Content>
                        <Tabs.Content value='adv'>
                            <SettingsPanelWithPropertySettings dto={dto} entityName={"GameModel"} editableKeyLabelDict={advancedEditables} />
                        </Tabs.Content>
                </Tabs.Root>
            </BasePanel>
        </Subscribable>
    );
}

export default GameSettingsPanel;