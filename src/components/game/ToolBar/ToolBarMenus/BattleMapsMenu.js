import * as React from 'react';
import { FaMap, FaPlus } from 'react-icons/fa';
import Battlemap from '../../Game';
import WebHelper from '../../../../helpers/WebHelper';
import DockableHelper from '../../../../helpers/DockableHelper';
import CommandFactory from '../../../BattleMap/Factories/CommandFactory';
import WebSocketManagerInstance from '../../WebSocketManager';
import Subscribable from '../../../uiComponents/base/Subscribable';
import DropDownMenu from '../../../uiComponents/base/DDItems/DropDownMenu';
import DropDownItem from '../../../uiComponents/base/DDItems/DropDownItem';
import CreateAndDeleteDropDownItem from '../../../uiComponents/base/DDItems/SpecialButtons/CreateAndDeleteDropDownButton';
import ClientMediator from '../../../../ClientMediator';
import InputModal from '../../../uiComponents/base/Modals/InputModal';
import CollectionSyncer from '../../../uiComponents/base/CollectionSyncer';

export const BattleMapsMenu = ({ state }) => {
    const [battleMaps, setBattleMaps] = React.useState(undefined);
    const [openedBattleMaps, setOpenedBattleMaps] = React.useState([]);
    const [game, setGame] = React.useState(undefined);

    const onCreateBmModalRef = React.useRef(null);

    React.useEffect(() => {
        ClientMediator.register(
            {
                panel: "BattleMapsMenu",
                id: "BattleMapsMenu",
                onEvent: (event, data) => {
                    console.warn("BattleMapsMenu", event, data);
                    if (event === "BattleMapsChanged") {
                        let openedBattleMaps = Object.values(data);
                        let game = ClientMediator.sendCommand("Game", "GetGame");
                        setOpenedBattleMaps(openedBattleMaps);
                        setGame(game);
                    }
                }
            }
        );

        WebHelper.get('battleMap/getBattleMaps', setBattleMaps);
    }, []);

    if (!battleMaps)
        return <></>;

    const AddBattleMap = (name, mapId) => {
        WebSocketManagerInstance.Send({Command: "battlemap_add", Data: {name, mapId}});
    }

    return (
        <DropDownMenu viewId={"views_battlemaps"} name={"Battle Maps"} submenu={true} icon={<FaMap/>} width={150}>
            <InputModal
                title={"Add new Battle Map"}
                getConfigDict={() => [
                    { key: "name", label: "Name", toolTip: "Name of battlemap.", type: "string", required: true },
                    { key: "map", label: "Map", toolTip: "Map to use for battlemap.", type: "select", options: game.maps.map(x => ({ value: x.id, label: x.name })), required: true }
                ]}
                openRef={onCreateBmModalRef}
                onCloseModal={({ name, map }, success) => { if (success) { AddBattleMap(name, map) } }} />
            <CollectionSyncer collection={battleMaps} setCollection={setBattleMaps} commandPrefix={"battlemap"} onAdd={(element, { playerId }) => {
                if(playerId === ClientMediator.sendCommand("Game", "GetCurrentPlayer").id)
                {
                    DockableHelper.NewFloating(state, <Battlemap withID={element.id} />);
                }
            }} />
            {battleMaps.filter(x => !openedBattleMaps.find(y => y.Id === x.id)).map(x =>
                <CreateAndDeleteDropDownItem
                    width={350}
                    name={x.name}

                    onDelete={() => {
                        let cmd = CommandFactory.CreateDeleteBattleMap(x.id);
                        WebSocketManagerInstance.Send(cmd);
                    }}

                    state={state}
                    element={<Battlemap withID={x.id} />} />
            )}
            <DropDownItem width={350} name={"Add new"} icon={FaPlus} onClick={() => {
                onCreateBmModalRef.current({name: "New BattleMap", map: game.maps[0].id});
            }} />
        </DropDownMenu>
    );
}

export default BattleMapsMenu;