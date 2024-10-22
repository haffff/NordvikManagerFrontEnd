import * as React from 'react';
import { Divider, Flex } from '@chakra-ui/react'
import { FaMap, FaChess } from 'react-icons/fa'
import * as Dockable from "@hlorenzi/react-dockable"
import BasePanel from '../../../uiComponents/base/BasePanel';
import DList from '../../../uiComponents/base/List/DList';
import DListItem from '../../../uiComponents/base/List/DListItem';
import DListItemToggleButton from '../../../uiComponents/base/List/ListItemDetails/DListItemToggleButton';
import Loadable from '../../../uiComponents/base/Loadable';
import SelectionModeToolsPanel from './SelectionModeToolsPanel';
import AddNewElementToolsPanel from './AddNewElementToolsPanel';
import RulersToolsPanel from './RulersToolsPanel';
import DContainer from '../../../uiComponents/base/Containers/DContainer';
import DButtonHorizontalContainer from '../../../uiComponents/base/Containers/DButtonHorizontalContainer';
import ClientMediator from '../../../../ClientMediator';
import useBMName from '../../../uiComponents/hooks/useBattleMapName';

export const ToolsPanel = ({ battleMapId }) => {
    const [selectedLayer, setSelectedLayer] = React.useState(undefined);

    const TokenLayer = 100;
    const BackgroundLayer = -100;

    const [action, setAction] = React.useState("SELECT");
    const [manyMode, setManyMode] = React.useState(false);

    const mapRef = React.useRef(undefined);

    const manyModeRef = React.useRef(undefined);
    manyModeRef.current = manyMode;

    const OnLoad = (finished) => {
        let layer = ClientMediator.sendCommand("BattleMap", "GetSelectedLayer", { contextId: battleMapId });

        if (!mapRef.current) {
            mapRef.current = ClientMediator.sendCommand("BattleMap", "GetSelectedMap", { contextId: battleMapId });
        }
        setSelectedLayer(layer);
        finished();
    }

    const ctx = Dockable.useContentContext();
    let name = useBMName(battleMapId);
    ctx.setTitle(`Tools - ` + name);

    return (
        <BasePanel>
            <Loadable OnLoad={OnLoad}>
                <DList>
                    <SelectionModeToolsPanel battleMapId={battleMapId} setAction={setAction} action={action} setManyMode={setManyMode} />
                    <AddNewElementToolsPanel battleMapId={battleMapId} setAction={setAction} action={action} setManyMode={setManyMode} manyMode={manyMode} map={mapRef.current} />
                    <RulersToolsPanel battleMapId={battleMapId} setAction={setAction} action={action} setManyMode={setManyMode} manyMode={manyMode} map={mapRef.current} />
                    <DContainer title={"Layer"}>
                        <DButtonHorizontalContainer>
                            <DListItemToggleButton isToggled={selectedLayer === BackgroundLayer} selectedColor={'white'} color={'gray'} onClick={() => {
                                ClientMediator.sendCommand("BattleMap", "SetSelectedLayer", { contextId: battleMapId, layerId: BackgroundLayer, withEditMode: true });
                                setSelectedLayer(BackgroundLayer);
                            }
                            } variant="outline" label='Background Layer' icon={FaMap} />

                            <Divider orientation='vertical' marginLeft={2} marginRight={2} />

                            <DListItemToggleButton selectedColor={'white'} color={'gray'} isToggled={selectedLayer === TokenLayer} onClick={() => {
                                ClientMediator.sendCommand("BattleMap", "SetSelectedLayer", { contextId: battleMapId, layerId: TokenLayer });
                                setSelectedLayer(TokenLayer);
                            }}
                                variant="outline"
                                label='Token Layer'
                                icon={FaChess} />
                        </DButtonHorizontalContainer>
                    </DContainer>
                </DList>
                {/* <HStack margin='2' spacing={1}>
                <IconButton onClick={SelectMode} aria-label='Add Shape' icon={<Icon as={FaMousePointer} />} />
                <IconButton onClick={DragMode} aria-label='Add Shape' icon={<Icon as={FaHandPaper} />} />
                <Divider orientation='vertical' />
                <IconButton onClick={ShowShapeMenu} aria-label='Add Shape' icon={<Icon as={FaShapes} />} />
            </HStack>
            {subMenu} */}
            </Loadable>
        </BasePanel>
    );
}
export default ToolsPanel;