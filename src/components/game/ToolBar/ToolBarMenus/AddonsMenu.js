import * as React from 'react';

import { FaCode, FaHammer, FaWpforms } from 'react-icons/fa';
import DebugConsolePanel from '../../panels/Addons/DebugConsolePanel';
import ActionsPanel from '../../panels/Addons/ActionsPanel';
import { IoMdDocument, IoMdFolder } from 'react-icons/io';
import CustomViewsPanel from '../../panels/Addons/CustomViewsPanel';
import AddonsManagePanel from '../../panels/Addons/AddonsManagePanel';
import TemplatesPanel from '../../panels/Addons/TemplatesPanel';
import DropDownMenu from '../../../uiComponents/base/DDItems/DropDownMenu';
import CreateDropDownButton from '../../../uiComponents/base/DDItems/SpecialButtons/CreateDropDownButton';

export const AddonsMenu = ({ state, gameDataManagerRef }) => {
    return (
        <DropDownMenu viewId={"addons"} gmOnly name="Addons" width={150} >
            <DropDownMenu viewId={"addons_addons"} name="Addons" submenu={true} width={150} expandableLocationName={"addons"} expandableWithAction={true} state={state} gameDataRef={gameDataManagerRef}>
                <CreateDropDownButton width={150} name="Addons Manage" icon={IoMdDocument} state={state} element={(<AddonsManagePanel gameDataRef={gameDataManagerRef} />)} />
            </DropDownMenu>
            {/* <CreateDropDownButton width={150} name="Actions" icon={FaHammer} state={state} element={(<AddonsPanel />)} /> */}
            <DropDownMenu viewId={"addons_views"} name="Views" submenu={true} width={150} expandableLocationName={"addons"} expandableWithAction={true} state={state} gameDataRef={gameDataManagerRef}>
                <CreateDropDownButton width={150} name="Views manager" icon={IoMdFolder} state={state} element={(<CustomViewsPanel state={state} gameDataRef={gameDataManagerRef} />)} />
                <CreateDropDownButton width={150} name="Templates" icon={IoMdFolder} state={state} element={(<TemplatesPanel state={state} gameDataRef={gameDataManagerRef} />)} />
                {/* <CreateDropDownButton width={150} name="View Builder" icon={FaWpforms} state={state} element={(<ViewBuildPanel />)} /> */}
            </DropDownMenu>
            <DropDownMenu viewId={"addons_code"} name="Code" submenu={true} width={150} expandableLocationName={"addons"} expandableWithAction={true} state={state} gameDataRef={gameDataManagerRef}>
                <CreateDropDownButton width={150} name="Actions" icon={FaHammer} state={state} element={(<ActionsPanel state={state} gameDataRef={gameDataManagerRef} />)} />
                <CreateDropDownButton width={150} name="Debug Console" icon={FaCode} state={state} element={(<DebugConsolePanel state={state} />)} />
            </DropDownMenu>

        </DropDownMenu>
    );
}
export default AddonsMenu;