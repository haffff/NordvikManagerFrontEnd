import * as React from 'react';
import ToolsPanel from '../../panels/ToolsPanel/ToolsPanel';
import MapSelector from '../../panels/MapSelector';
import ChatPanel from '../../panels/ChatPanel';
import { FaElementor, FaMap, FaMapSigns, FaPaintBrush, FaTools, FaUserAlt, FaUserCog, FaUserFriends } from 'react-icons/fa';
import PropertiesPanel from '../../panels/PropertiesPanel';
import { IoMdChatboxes, IoMdSettings } from 'react-icons/io';
import PlayersPanel from '../../panels/PlayersPanel';
import AdminPlayersPanel from '../../panels/AdminPlayersPanel';
import { BattleMapsMenu } from './BattleMapsMenu';
import OnlyOwner from '../../../uiComponents/base/OnlyOwner';
import CardsPanel from '../../panels/CardsPanel';
import MaterialsPanel from '../../panels/MaterialsPanel';
import DropDownMenu from '../../../uiComponents/base/DDItems/DropDownMenu';
import CreateDropDownButton from '../../../uiComponents/base/DDItems/SpecialButtons/CreateDropDownButton';
import ClientMediator from '../../../../ClientMediator';
import useClientMediator from '../../../uiComponents/hooks/useClientMediator';

export const ViewsMenu = ({ state,
    onDropDown
}) => {
    const [battleMaps, setBattleMaps] = React.useState([]);

    useClientMediator("OpenedBattleMapsMenu", { onEvent: (event,data) => {
        if(event === "BattleMapsChanged")
        {
            console.log(data);
            Object.values(data)?.forEach(x => x.name = ClientMediator.sendCommand("BattleMap","GetName",{contextId:x.Id}));
            setBattleMaps(data);
        }
        if(event === "BattleMapNameChanged")
        {
            let contextId = data.contextId;
            let name = data.name;
            let newBattleMaps = {...battleMaps};
            let element = newBattleMaps[contextId];
            if(element)
            {
                element.name = name;
                setBattleMaps(newBattleMaps);
            }
        }
    }});

    const GetBMViewMenu = (battleMapId) => {
        let menu = [(<CreateDropDownButton width={150} name={"Tools"} icon={FaTools} state={state} element={<ToolsPanel battleMapId={battleMapId} />} />)];

        menu.push([
            (<OnlyOwner><CreateDropDownButton width={150} name={"Map Selector"} icon={FaMapSigns} state={state} element={<MapSelector battleMapId={battleMapId} state={state} />} /></OnlyOwner>),
            (<OnlyOwner><CreateDropDownButton width={150} name={"Properties"} icon={IoMdSettings} state={state} element={<PropertiesPanel battlemapId={battleMapId} />} /></OnlyOwner>),
        ]);

        return menu;
    }

    const GetViewBMRelatedMenus = () => {
        if(!battleMaps)
        {
            return [];
        }
        return Object.values(battleMaps).map(x =>
            {
            return (<DropDownMenu submenu={true} name={x.name} width={150}>
                {GetBMViewMenu(x.Id)}
            </DropDownMenu>)})
    }
    
    return (
        <DropDownMenu onDropDown={onDropDown} name={"View"} width={150} expandableWithAction={true} expandableLocationName={"views"}>
            {/*Add 'disabled' option here*/}
            <BattleMapsMenu key={'1'} state={state} />
            <CreateDropDownButton width={150} name={"Chat"} icon={IoMdChatboxes} state={state} element={<ChatPanel />} />
            <CreateDropDownButton width={150} name={"Players"} icon={FaUserFriends} state={state} element={<PlayersPanel />} />
            <CreateDropDownButton width={150} name={"Cards"} icon={FaUserAlt} state={state} element={<CardsPanel state={state} />} />
            <CreateDropDownButton width={150} name={"Materials"} icon={FaPaintBrush} state={state} element={<MaterialsPanel state={state} />} />
            <OnlyOwner>
                <CreateDropDownButton width={150} name={"Manage Players"} icon={FaUserCog} state={state} element={<AdminPlayersPanel state={state} />} />
            </OnlyOwner>
            {GetViewBMRelatedMenus()}
        </DropDownMenu>
    );
}
export default ViewsMenu;