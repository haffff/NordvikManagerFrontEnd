import * as React from 'react';
import { HStack, Button, Box, Stack, Divider, Textarea, Grid, GridItem, Flex, Card, CardHeader, CardBody, Heading, Center, Badge, FormLabel, Input, Checkbox, NumberInput, NumberInputField } from '@chakra-ui/react'
import * as Dockable from "@hlorenzi/react-dockable"
import SettingsPanel from './SettingsPanel';
import CommandFactory from '../../BattleMap/Factories/CommandFactory';
import WebSocketManagerInstance from '../WebSocketManager';
import Subscribable from '../../uiComponents/base/Subscribable';
import useGame from '../../uiComponents/hooks/useGameHook';

export const PlayerSettingsPanel = ({ player }) => {

    const editables = [
        { key: "name", label: "Name", toolTip: "Name of player.", type: "string" },
        { key: "image", label: "Avatar", toolTip: "Image of player.", type: "image" },
        { key: "color", label: "Color", toolTip: "Color of player.", type: "color" },
    ]

    const ctx = Dockable.useContentContext();
    ctx.setTitle(`Player settings`);
    let game = useGame();
    if(!game) {
        return <></>;
    }

    let gameData = game;
    
    let dto = player;


    const sendSettingsUpdate = (dtoToSend) => {
        dtoToSend.id = dto.id;

        let dtoToSave = structuredClone(dto);
        Object.keys(dtoToSend).forEach(key => {
            if (dtoToSend[key] !== undefined && dtoToSend[key] !== null) {
                dtoToSave[key] = dtoToSend[key];
            }
        });

        let command = CommandFactory.CreatePlayerSettingsCommand(dtoToSave);
        WebSocketManagerInstance.Send(command);
    }

    const updateSettings = (event) => {
        let player = gameData.players.filter(x => x.id === event.data.id)[0];
        player.name = event.data.name;
    }

    return (
        <Subscribable commandPrefix={"settings_player"} onMessage={updateSettings}>
            <SettingsPanel dto={dto} editableKeyLabelDict={editables} onSave={sendSettingsUpdate} />
        </Subscribable>
    );
}
export default PlayerSettingsPanel;