import * as React from 'react';
import GameSettingsPanel from '../../settings/GameSettingsPanel';
import PlayerSettingsPanel from '../../settings/PlayerSettingsPanel';
import CreateDropDownButton from '../../../uiComponents/base/DDItems/SpecialButtons/CreateDropDownButton';
import DropDownMenu from '../../../uiComponents/base/DDItems/DropDownMenu';
import ClientMediator from '../../../../ClientMediator';
import { FaUser, FaWrench } from 'react-icons/fa';

export const SettingsMenu = ({ Dockable,
    state,
})  => {
    const [currentPlayer, setCurrentPlayer] = React.useState(undefined);

    if(!currentPlayer)
    {
        ClientMediator.sendCommandWaitForRegister("Game","GetCurrentPlayer",{},true).then(x => setCurrentPlayer(x));
    }

    return (
        <DropDownMenu viewId={"settings"} name={"Settings"} width={100} expandableLocationName={"settings"} expandableWithAction={true} state={state}>
            <CreateDropDownButton gmOnly width={150} name={"Game"} icon={<FaWrench />} state={state} element={<GameSettingsPanel />} />
            <CreateDropDownButton width={150} name={"Player"} icon={<FaUser />} state={state} element={<PlayerSettingsPanel player={currentPlayer} />} />
        </DropDownMenu>
    );
}
export default SettingsMenu;