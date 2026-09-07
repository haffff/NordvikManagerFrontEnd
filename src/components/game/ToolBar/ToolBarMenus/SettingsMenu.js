import * as React from 'react';
import GameSettingsPanel from '../../settings/GameSettingsPanel';
import PlayerSettingsPanel from '../../settings/PlayerSettingsPanel';
import KeyboardShortcutsPanel from '../../settings/KeyboardShortcutsPanel';
import CreateDropDownButton from '../../../uiComponents/base/DDItems/SpecialButtons/CreateDropDownButton';
import DropDownMenu from '../../../uiComponents/base/DDItems/DropDownMenu';
import ClientMediator from '../../../../ClientMediator';
import { FaUser, FaWrench, FaKeyboard } from 'react-icons/fa';

export const SettingsMenu = ({ Dockable,
    state,
})  => {
    const [currentPlayer, setCurrentPlayer] = React.useState(undefined);

    // Was a side effect directly in the render body — re-fired on every re-render
    // until it resolved (sendCommandWaitForRegister has no de-dupe, so each
    // re-render queued another awaiting-request), and had no unmount guard.
    React.useEffect(() => {
        let cancelled = false;
        ClientMediator.sendCommandWaitForRegister("Game","GetCurrentPlayer",{},true).then(x => {
            if (!cancelled) setCurrentPlayer(x);
        });
        return () => { cancelled = true; };
    }, []);

    return (
        <DropDownMenu viewId={"settings"} name={"Settings"} width={100} expandableLocationName={"settings"} expandableWithAction={true} state={state}>
            <CreateDropDownButton gmOnly width={150} name={"Game"} icon={<FaWrench />} state={state} element={<GameSettingsPanel />} />
            <CreateDropDownButton width={150} name={"Player"} icon={<FaUser />} state={state} element={<PlayerSettingsPanel player={currentPlayer} />} />
            <CreateDropDownButton width={150} name={"Keyboard Shortcuts"} icon={<FaKeyboard />} state={state} element={<KeyboardShortcutsPanel />} />
        </DropDownMenu>
    );
}
export default SettingsMenu;