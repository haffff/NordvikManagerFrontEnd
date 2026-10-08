import * as React from 'react';
import GameSettingsPanel from '../../settings/GameSettingsPanel';
import PlayerSettingsPanel from '../../settings/PlayerSettingsPanel';
import KeyboardShortcutsPanel from '../../settings/KeyboardShortcutsPanel';
import CreateDropDownButton from '../../../uiComponents/base/DDItems/SpecialButtons/CreateDropDownButton';
import DropDownMenu from '../../../uiComponents/base/DDItems/DropDownMenu';
import { FaUser, FaWrench, FaKeyboard } from 'react-icons/fa';

export const SettingsMenu = ({ Dockable,
    state,
})  => {
    // Player settings without a player are your own (resolved when the panel opens).
    return (
        <DropDownMenu viewId={"settings"} name={"Settings"} width={100} expandableLocationName={"settings"} expandableWithAction={true} state={state}>
            <CreateDropDownButton gmOnly width={150} name={"Game"} icon={<FaWrench />} state={state} element={<GameSettingsPanel />} />
            <CreateDropDownButton width={150} name={"Player"} icon={<FaUser />} state={state} element={<PlayerSettingsPanel />} />
            <CreateDropDownButton width={150} name={"Keyboard Shortcuts"} icon={<FaKeyboard />} state={state} element={<KeyboardShortcutsPanel />} />
        </DropDownMenu>
    );
}
export default SettingsMenu;