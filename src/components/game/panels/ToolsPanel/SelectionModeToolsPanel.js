import * as React from 'react';
import { Flex } from '@chakra-ui/react'
import { FaMousePointer, FaHandPaper } from 'react-icons/fa'
import DListItemToggleButton from '../../../uiComponents/base/List/ListItemDetails/DListItemToggleButton';
import BattleMapOperations from '../../../BattleMap/BattlemapModes';
import DContainer from '../../../uiComponents/base/Containers/DContainer';
import ClientMediator from '../../../../ClientMediator';

export const SelectionModeToolsPanel = ({battleMapId, setAction, action, setManyMode }) => {

    const SelectMode = () => {
        ClientMediator.sendCommand("BattleMap", "SetOperationMode", { contextId: battleMapId, mode: BattleMapOperations.SELECT });
        setManyMode(false);
        setAction("SELECT");
    }

    const DragMode = () => {
        setManyMode(false);
        ClientMediator.sendCommand("BattleMap", "SetOperationMode", { contextId: battleMapId, mode: BattleMapOperations.DRAG });
        setAction("DRAG");
    }

    return (
        <DContainer title={"Selection"}>
            <Flex direction={'row'}>
                <DListItemToggleButton onClick={SelectMode} isToggled={action == "SELECT"} selectedColor={'white'} color={'gray'} label={"Select mode"} variant="outline" icon={FaMousePointer} />
                <DListItemToggleButton onClick={DragMode} isToggled={action == "DRAG"} selectedColor={'white'} color={'gray'} label={"Drag mode"} variant="outline" icon={FaHandPaper} />
            </Flex>
        </DContainer>
    );
}
export default SelectionModeToolsPanel;