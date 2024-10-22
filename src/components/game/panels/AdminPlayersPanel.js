import * as React from 'react';
import { Circle } from '@chakra-ui/react'
import * as Dockable from "@hlorenzi/react-dockable"
import { FaCog, FaUserSlash } from 'react-icons/fa';
import PlayerSettingsPanel from '../settings/PlayerSettingsPanel';
import DList from '../../uiComponents/base/List/DList';
import DListItemButton from '../../uiComponents/base/List/ListItemDetails/DListItemButton';
import PlayerAvatar from '../../uiComponents/PlayerAvatar';
import DListItem from '../../uiComponents/base/List/DListItem';
import WebSocketManagerInstance from '../WebSocketManager';
import CommandFactory from '../../BattleMap/Factories/CommandFactory';
import DListItemsButtonContainer from '../../uiComponents/base/List/DListItemsButtonContainer';
import DLabel from '../../uiComponents/base/Text/DLabel';
import ClientMediator from '../../../ClientMediator';
import useClientMediator from '../../uiComponents/hooks/useClientMediator';

export const AdminPlayersPanel = ({ state }) => {

    const [players, setPlayers] = React.useState([]);
    const [connectedPlayers, setConnectedPlayers] = React.useState([]);

    const HandleMessage = () => {
        ClientMediator.sendCommandAsync("Game", "GetPlayers", {}, true).then(setPlayers);
        ClientMediator.sendCommandAsync("Game", "GetConnectedPlayers", {}, true).then(setConnectedPlayers);
    }

    useClientMediator("AdminPlayersPanel", {Reload: HandleMessage});
    
    React.useState(() => {
        HandleMessage();
    }, []);


    const ctx = Dockable.useContentContext();
    ctx.setTitle(`Manage Players`);

    const createPlayersList = () => {

        if (!connectedPlayers || !players) {
            return [];
        }

        let connectedIds = connectedPlayers.map(x => x.id);

        let playerList = players.map(x => {
            return { isConnected: connectedIds.includes(x.id), isPlayer: x.id === 0, player: x }
        });
        playerList.sort((x) => x.isConnected).sort((x) => !x.isPlayer);
        return playerList;
    }

    const HandleKick = ({id}) => {
        let cmd = CommandFactory.CreateKickPlayerCommand(id);
        WebSocketManagerInstance.Send(cmd);
    }

    const createPlayerPanel = (x) => {
        return (
            <DListItem isSelected={x.isPlayer}>
                    <Circle width={3} height={3} marginRight={2} backgroundColor={x.isConnected ? 'green' : 'red'} />
                    <DLabel>{x.player.name ? x.player.name : x.player.Name}</DLabel>
                    <DListItemsButtonContainer>
                        <PlayerAvatar player={x.player} />
                        <DListItemButton label="Kick" hidden={x.isPlayer} onClick={() => HandleKick(x.player)} icon={FaUserSlash} color={"red"} />
                        <DListItemButton label="Settings" onClick={() => {
                            Dockable.spawnFloating(state, <PlayerSettingsPanel player={x.player} />);
                        }} icon={FaCog} />
                    </DListItemsButtonContainer>
            </DListItem>
        );
    }

    return (
        <>
            <DList mainComponent={true}>
                {createPlayersList().map(x => createPlayerPanel(x))}
            </DList>
        </>
    )
}
export default AdminPlayersPanel;