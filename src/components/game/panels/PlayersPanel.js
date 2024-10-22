import * as React from 'react';
import { Flex, Circle, FormLabel} from '@chakra-ui/react'
import * as Dockable from "@hlorenzi/react-dockable"
import DList from '../../uiComponents/base/List/DList';
import DListItem from '../../uiComponents/base/List/DListItem';
import PlayerAvatar from '../../uiComponents/PlayerAvatar';
import DListItemsButtonContainer from '../../uiComponents/base/List/DListItemsButtonContainer';
import DLabel from '../../uiComponents/base/Text/DLabel';
import ClientMediator from '../../../ClientMediator';
import useClientMediator from '../../uiComponents/hooks/useClientMediator';

export const PlayersPanel = () => {
    const [players, setPlayers] = React.useState([]);
    const [connectedPlayers, setConnectedPlayers] = React.useState([]);

    const HandleMessage = () => {
        ClientMediator.sendCommandAsync("Game", "GetPlayers", {}, true).then(setPlayers);
        ClientMediator.sendCommandAsync("Game", "GetConnectedPlayers", {}, true).then(setConnectedPlayers);
    }

    const HandleEvent = (ev,data) =>
    {
        if(ev === "PlayersChanged")
        {
            HandleMessage();
        }
    }

    useClientMediator("PlayersPanel", {onEvent: HandleEvent});
    
    React.useState(() => {
        HandleMessage();
    }, []);

    const ctx = Dockable.useContentContext();
    ctx.setTitle(`Players`);

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

    const createPlayerPanel = (x) => {
        return (
            <DListItem key={x.id} isSelected={x.isPlayer}>
                    <Circle width={3} height={3} marginRight={2} backgroundColor={x.isConnected ? 'green' : 'red'} />
                    <DLabel>{x.player.name ? x.player.name : x.player.Name}</DLabel>
                    <DListItemsButtonContainer>
                        <PlayerAvatar player={x.player} />
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
export default PlayersPanel;