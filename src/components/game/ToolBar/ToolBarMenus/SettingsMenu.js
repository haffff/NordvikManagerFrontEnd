import * as React from 'react';
import GameSettingsPanel from '../../settings/GameSettingsPanel';
import PlayerSettingsPanel from '../../settings/PlayerSettingsPanel';
import CreateDropDownButton from '../../../uiComponents/base/DDItems/SpecialButtons/CreateDropDownButton';
import DropDownMenu from '../../../uiComponents/base/DDItems/DropDownMenu';
import ClientMediator from '../../../../ClientMediator';

export const SettingsMenu = ({ Dockable,
    state,
})  => {
    const [currentPlayer, setCurrentPlayer] = React.useState(undefined);

    if(!currentPlayer)
    {
        ClientMediator.sendCommandAsync("Game","GetCurrentPlayer",{}).then(x => setCurrentPlayer(x));
    }

    return (
        <DropDownMenu name={"Settings"} width={100} expandableLocationName={"settings"} expandableWithAction={true} state={state}>
            <CreateDropDownButton width={150} name={"Game"} state={state} element={<GameSettingsPanel />} />
            <CreateDropDownButton width={150} name={"Player"} state={state} element={<PlayerSettingsPanel player={currentPlayer} />} />
        </DropDownMenu>
    );
}
export default SettingsMenu;