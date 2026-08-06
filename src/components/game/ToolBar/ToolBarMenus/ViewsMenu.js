import * as React from 'react';
import ToolsPanel from '../../panels/ToolsPanel/ToolsPanel';
import ChatPanel from '../../panels/ChatPanel';
import { FaMusic, FaPaintBrush, FaTools, FaUserAlt, FaUserCog, FaUserFriends, FaVolumeUp } from 'react-icons/fa';
import { IoMdChatboxes } from 'react-icons/io';
import PlayersPanel from '../../panels/PlayersPanel';
import AdminPlayersPanel from '../../panels/AdminPlayersPanel';
import { BattleMapsMenu } from './BattleMapsMenu';
import CardsPanel from '../../panels/CardsPanel';
import MaterialsPanel from '../../panels/MaterialsPanel';
import PlaylistsPanel from '../../panels/PlaylistsPanel';
import SoundboardPanel from '../../panels/SoundboardPanel';
import DropDownMenu from '../../../uiComponents/base/DDItems/DropDownMenu';
import CreateDropDownButton from '../../../uiComponents/base/DDItems/SpecialButtons/CreateDropDownButton';
import ClientMediator from '../../../../ClientMediator';
import InputModal from '../../../uiComponents/base/Modals/InputModal';
import CollectionSyncer from '../../../uiComponents/base/CollectionSyncer';
import { ActiveTransportManager as WebSocketManagerInstance } from '../../../../helpers/transport';

export const ViewsMenu = ({ state, onDropDown }) => {
    const [maps, setMaps] = React.useState([]);
    const onCreateBmModalRef = React.useRef(null);

    React.useEffect(() => {
        ClientMediator.sendCommandWaitForRegisterAsync("Game", "GetMaps", {}, true)
            .then(m => setMaps(m || []));
    }, []);

    const AddBattleMap = (name, mapId) => {
        WebSocketManagerInstance.Send({ command: "battlemap_add", data: { name, mapId } });
    };

    return (
        <>
            <DropDownMenu viewId={"views"} onDropDown={onDropDown} name={"View"} width={150} expandableWithAction={true} expandableLocationName={"views"}>
                <BattleMapsMenu key={'1'} state={state} maps={maps} onCreateBmModalRef={onCreateBmModalRef} />
                <CreateDropDownButton width={150} name={"Tools"} icon={<FaTools />} state={state} element={<ToolsPanel />} />
                <CreateDropDownButton width={150} name={"Chat"} icon={<IoMdChatboxes />} state={state} element={<ChatPanel />} />
                <CreateDropDownButton width={150} name={"Players"} icon={<FaUserFriends />} state={state} element={<PlayersPanel />} />
                <CreateDropDownButton width={150} name={"Cards"} icon={<FaUserAlt />} state={state} element={<CardsPanel state={state} />} />
                <CreateDropDownButton width={150} name={"Materials"} icon={<FaPaintBrush />} state={state} element={<MaterialsPanel state={state} />} />
                <CreateDropDownButton gmOnly width={150} name={"Playlists"} icon={<FaMusic />} state={state} element={<PlaylistsPanel state={state} />} />
                <CreateDropDownButton gmOnly width={150} name={"Soundboard"} icon={<FaVolumeUp />} state={state} element={<SoundboardPanel state={state} />} />
                <CreateDropDownButton gmOnly width={150} name={"Manage Players"} icon={<FaUserCog />} state={state} element={<AdminPlayersPanel state={state} />} />
            </DropDownMenu>
            {/* Keep maps in sync with server events so the "Add new" dialog and Switch Map always reflect current maps */}
            <CollectionSyncer collection={maps} setCollection={setMaps} commandPrefix={"map"} />
            <InputModal
                title={"Add new Battle Map"}
                getConfigDict={() => [
                    { key: "name", label: "Name", toolTip: "Name of battlemap.", type: "string", required: true },
                    { key: "map", label: "Map", toolTip: "Map to use for battlemap.", type: "select", options: maps.map(x => ({ value: x.id, label: x.name })), required: true }
                ]}
                openRef={onCreateBmModalRef}
                onCloseModal={({ name, map }, success) => { if (success) { AddBattleMap(name, map); } }}
            />
        </>
    );
}
export default ViewsMenu;
