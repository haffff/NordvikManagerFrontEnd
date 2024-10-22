import * as React from 'react';
import { RadioGroup, Radio, Stack } from '@chakra-ui/react'
import * as Dockable from "@hlorenzi/react-dockable"
import CommandFactory from '../../BattleMap/Factories/CommandFactory';
import { FaPlus, FaRemoveFormat, FaWrench, FaXbox } from 'react-icons/fa';
import WebHelper from '../../../helpers/WebHelper';
import WebSocketManagerInstance from '../WebSocketManager';
import Subscribable from '../../uiComponents/base/Subscribable';
import MapSettingsPanel from '../settings/MapSettingsPanel';
import { IoIosRemoveCircleOutline, IoMdRemove } from 'react-icons/io';
import DList from '../../uiComponents/base/List/DList';
import DListItem from '../../uiComponents/base/List/DListItem';
import DListItemButton from '../../uiComponents/base/List/ListItemDetails/DListItemButton';
import DListItemsButtonContainer from '../../uiComponents/base/List/DListItemsButtonContainer';
import BasePanel from '../../uiComponents/base/BasePanel';
import ClientMediator from '../../../ClientMediator';
import useBMName from '../../uiComponents/hooks/useBattleMapName';
import CollectionSyncer from '../../uiComponents/base/CollectionSyncer';

export const MapSelector = ({ battleMapId, state }) => {
    const [value, setValue] = React.useState(-1);
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    const [maps, setMaps] = React.useState([]);

    const HandleSettings = (id) => {
        WebHelper.get(`map/get?mapId=${id}`, (r) => {
            Dockable.spawnFloating(state, <MapSettingsPanel map={r} />);
        });
    }

    const Reload = () => {
        WebHelper.get(`map/getAllFlat`, setMaps );
    }

    React.useEffect(() => {
        Reload();
    }, []);

    const bmName = useBMName(battleMapId);

    const GenerateElements = () => {
        let mappedMaps = maps.map(x => {
            return (
                <DListItem>
                    <Radio value={x.id} width='100%'>
                        {x.name}
                    </Radio>
                    <DListItemsButtonContainer>
                        <DListItemButton label={'Remove'} color={'red'} hidden={x.id === value} icon={IoIosRemoveCircleOutline} onClick={() => HandleMapDelete(x.id)} />
                        <DListItemButton label={'Settings'} icon={FaWrench} onClick={() => HandleSettings(x.id)} />
                    </DListItemsButtonContainer>
                </DListItem>
            );
        });
        return mappedMaps;
    };

    const ctx = Dockable.useContentContext();
    ctx.setTitle(`Map Selector - ` + bmName);

    if (value === -1) {
        ClientMediator.sendCommandAsync("BattleMap", "GetSelectedMapID", { contextId: battleMapId }, true).then((r) => { setValue(r) });
    }



    const HandleSelectedMapChange = (e) => {
        let command = CommandFactory.CreateChangeMapCommand(e, battleMapId);
        WebSocketManagerInstance.Send(command);
    }

    const HandleMapDelete = (id) => {
        let cmd = CommandFactory.CreateMapRemoveCommand(id);
        WebSocketManagerInstance.Send(cmd);
    }

    const HandleAdd = () => {
        let cmd = CommandFactory.CreateMapAddCommand();
        WebSocketManagerInstance.Send(cmd);
    }

    return (
        <BasePanel>
            <CollectionSyncer collection={maps} setCollection={setMaps} commandPrefix={"map"} setSelectedItem={() => {}} onSelectedChanged={(item) => 
            {
                setValue(item.mapId);
            }
            } 
                selectItemCommand={"map_change"} />
            <DList mainComponent={true} withAddButton={true} handleAdd={HandleAdd}>
                <RadioGroup onChange={HandleSelectedMapChange} value={value}>
                    <Stack padding={0}>
                        {GenerateElements()}
                    </Stack>
                </RadioGroup>
            </DList>
        </BasePanel>
    )
}
export default MapSelector;