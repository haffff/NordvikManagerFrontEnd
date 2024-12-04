import * as React from 'react';
import { Flex, FormLabel, Select } from '@chakra-ui/react'
import CommandFactory from '../../BattleMap/Factories/CommandFactory';
import WebSocketManagerInstance from '../WebSocketManager';
import Subscribable from '../../uiComponents/base/Subscribable';
import Loadable from '../../uiComponents/base/Loadable';
import WebHelper from '../../../helpers/WebHelper';
import UtilityHelper from '../../../helpers/UtilityHelper';
import DList from '../../uiComponents/base/List/DList';
import DListItem from '../../uiComponents/base/List/DListItem';
import DButtonHorizontalContainer from '../../uiComponents/base/Containers/DButtonHorizontalContainer';
import DropDownButton from '../../uiComponents/base/DDItems/DropDrownButton';
import useGame from '../../uiComponents/hooks/useGameHook';
import ClientMediator from '../../../ClientMediator';

export const SecuritySettingsPanel = ({ dto, type }) => {
    const [players, setPlayers] = React.useState(undefined);
    const [currentPlayerId, setCurrentPlayerId] = React.useState(null);
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    const game = useGame();

    React.useEffect(() => {
        ClientMediator.sendCommandWaitForRegister("Game", "GetPlayers", {}, true).then(setPlayers);
        ClientMediator.sendCommandWaitForRegister("Game", "GetCurrentPlayer", {}, true).then(({id}) => setCurrentPlayerId(id));
    }, []);

    if(!game || !players) {
        return <></>;
    }

    const Load = (finished) => {
        WebHelper.get(`security/permissions?gameId=${game.id}&entityId=${dto.id}&entityType=${type}`, (permissions) => {
            let loaclPlayers = structuredClone(players);

            loaclPlayers.forEach(player => {
                let permission = permissions[player.id];
                if (permission === undefined) {
                    permission = -1;
                }
                player.permission = permission;
            });
            loaclPlayers.push({ id: UtilityHelper.EmptyGuid, name: "All", permission: permissions[UtilityHelper.EmptyGuid] });

            setPlayers(loaclPlayers);
            finished();
        });
    }

    const predefinedRoles = [
        { name: "Not set", value: -1, description: "Permission has not been set" },
        { name: "None", value: 0, description: "Permission has not been set" },
        { name: "See", value: 1, description: "User can see this element" },
        { name: "Control", value: 7, description: "User can control/execute things in element(This doesn't include edit nor remove!)" },
        { name: "Edit", value: 7, description: "User can Edit things in element(This doesn't include removing!)" },
        { name: "All", value: 31, description: "User has full control over element" },
    ]

    const preparePanel = (player) => {
        return (
            <DListItem padding={"10px"} isSelected={player.id === currentPlayerId} >
                <FormLabel width='40%'>
                    {player.name}
                </FormLabel>
                <Flex width={'60%'} grow={1} direction={'row-reverse'}>
                    <Select value={player.permission} onChange={(x) => { player.permission = x.target.value; forceUpdate() }} size='sm'>
                        {predefinedRoles.map(x => (<option value={x.value} style={{ backgroundColor: 'rgba(50,50,50,50.5)' }} key={x.name}>{x.name}</option>))}
                    </Select>
                </Flex>
            </DListItem>)
    }

    const HandleEdit = () => {
        let newPermissions = {};
        players.forEach(element => {
            let permission = parseInt(element.permission);
            newPermissions[element.id] = permission;
        });

        let cmd = CommandFactory.CreateUpdatePermissionsCommand(dto.id, type, newPermissions);
        WebSocketManagerInstance.Send(cmd);
    }

    const HandleIncomingUpdate = (cmd) => {
        if (cmd.data["id"] == dto.id) {
            let newPlayers = structuredClone(players);
            newPlayers.forEach(player => {
                let permission = cmd.data["permissions"][player.id];
                if (permission === undefined) {
                    permission = -1;
                }
                player.permission = permission;
            });
            setPlayers(newPlayers);
        }
    }

    return (
        <Loadable OnLoad={Load}>
            <Subscribable commandPrefix={"permissions_update"} onMessage={HandleIncomingUpdate} />
            <DList>
                {players.map(x => preparePanel(x))}
            </DList>
            <DButtonHorizontalContainer>
                <DropDownButton width={200} name={"Save"} onClick={() => HandleEdit()} />
            </DButtonHorizontalContainer>
        </Loadable>
    );
}
export default SecuritySettingsPanel;