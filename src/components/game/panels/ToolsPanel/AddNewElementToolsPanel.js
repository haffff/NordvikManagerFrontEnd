import * as React from 'react';
import { Divider, Flex, Input } from '@chakra-ui/react'
import { fabric } from 'fabric';
import { FaSquare, FaCircle, FaTextHeight, FaRulerCombined, FaCircleNotch } from 'react-icons/fa'
import CommandFactory from '../../../BattleMap/Factories/CommandFactory';
import WebSocketManagerInstance from '../../WebSocketManager';
import DListItemToggleButton from '../../../uiComponents/base/List/ListItemDetails/DListItemToggleButton';
import BattleMapOperations from '../../../BattleMap/BattlemapModes';
import ColorPicker from '../../../uiComponents/ColorPicker';
import DContainer from '../../../uiComponents/base/Containers/DContainer';
import { IoMdClose } from 'react-icons/io';
import ClientMediator from '../../../../ClientMediator';

export const AddNewElementToolsPanel = ({ battleMapId, setAction, action, setManyMode, manyMode, map }) => {
    const [options, setOptions] = React.useState({
        fill: 'rgba(0,0,0,1)',
        stroke: 'rgba(0,0,0,1)',
        strokeWidth: 1,
        opacity: 1,
        alignToCenter: false,
        alignToCorner: true,
    });

    const optionsRef = React.useRef(undefined);
    optionsRef.current = options;
    const manyModeRef = React.useRef(undefined);
    manyModeRef.current = manyMode;

    const calculateCoords = (coords) => {
        let x = coords.x;
        let y = coords.y;

        if (map.gridVisible && (optionsRef.current.alignToCenter || optionsRef.current.alignToCorner)) {
            var gridSize = map.gridSize;
            x = Math.round(x / gridSize) * gridSize;
            y = Math.round(y / gridSize) * gridSize;
            if (optionsRef.current.alignToCenter) {
                x += gridSize / 2;
                y += gridSize / 2;
            }
        }

        return { x, y };
    }

    const AddRect = () => {
        setManyMode(action == "ADDRECT");
        setAction("ADDRECT");
        let type = new fabric.Rect({ name: "Rectangle" });

        const onStart = (coords, canvas) => {
            const { x, y } = calculateCoords(coords);

            canvas.add(type);
            type.width = 0;
            type.height = 0;
            type.left = x;
            type.top = y;
        }

        const onUpdate = (coords, canvas) => {
            const { x, y } = calculateCoords(coords);
            type.set(optionsRef.current);

            if (x < type.left) {

            }
            else {
                type.set({ width: Math.abs(x - type.left) });
            }

            if (y < type.top) {

            }
            else {
                type.set({ height: Math.abs(y - type.top) });
            }
        }

        const onEnd = (coords, canvas) => {
            if (type.width < 15 || type.height < 15) {
                canvas.remove(type);
                return;
            }

            canvas.remove(type);
            WebSocketManagerInstance.Send(CommandFactory.CreateAddCommand(
                {
                    object: JSON.stringify(type),
                    mapId: ClientMediator.sendCommand("BattleMap", "GetSelectedMapID", { contextId: battleMapId }),
                    layer: ClientMediator.sendCommand("BattleMap", "GetSelectedLayer", { contextId: battleMapId })
                }
                , false));

            if (!manyModeRef.current) {
                SelectMode();
            }
        }

        ClientMediator.sendCommand("BattleMap", "SetArguments", { contextId: battleMapId, value: { onStart, onUpdate, onEnd } });
        ClientMediator.sendCommand("BattleMap", "SetOperationMode", { contextId: battleMapId, mode: BattleMapOperations.DISPLAY });
    }

    const AddCircle = () => {
        setManyMode(action == "ADDCIRCLE");
        setAction("ADDCIRCLE");
        let type = new fabric.Circle({ name: "Circle" });

        const onStart = (coords, canvas) => {
            const { x, y } = calculateCoords(coords);
            type.originX = 'center';
            type.originY = 'center';
            type.left = x;
            type.top = y;
            canvas.add(type);
        }

        const onUpdate = (coords, canvas) => {
            let { x, y } = calculateCoords(coords);
            type.set(optionsRef.current);
            x = x - type.left;
            y = y - type.top;
            let radius = Math.sqrt(x ** 2 + y ** 2);
            type.set({ radius });
        }

        const onEnd = (coords, canvas) => {
            canvas.remove(type);
            WebSocketManagerInstance.Send(CommandFactory.CreateAddCommand(
                {
                    object: JSON.stringify(type),
                    mapId: ClientMediator.sendCommand("BattleMap", "GetSelectedMapID", { contextId: battleMapId }),
                    layer: ClientMediator.sendCommand("BattleMap", "GetSelectedLayer", { contextId: battleMapId })
                }
                , false));
            if (!manyModeRef.current) {
                SelectMode();
            }
        }

        ClientMediator.sendCommand("BattleMap", "SetArguments", { contextId: battleMapId, value: { onStart, onUpdate, onEnd } });
        ClientMediator.sendCommand("BattleMap", "SetOperationMode", { contextId: battleMapId, mode: BattleMapOperations.DISPLAY });
    }

    const AddElement = (type) => {
        const onStart = (coords, canvas) => {
            const { x, y } = calculateCoords(coords);
            type.left = x;
            type.top = y;
            canvas.add(type);
        }

        const onUpdate = (coords, canvas) => {
            type.set(optionsRef.current);
            const { x, y } = calculateCoords(coords);
            type.left = x;
            type.top = y;
        }

        const onEnd = (coords, canvas) => {
            canvas.remove(type);
            WebSocketManagerInstance.Send(CommandFactory.CreateAddCommand(
                {
                    object: JSON.stringify(type),
                    mapId: ClientMediator.sendCommand("BattleMap", "GetSelectedMapID", { contextId: battleMapId }),
                    layer: ClientMediator.sendCommand("BattleMap", "GetSelectedLayer", { contextId: battleMapId })
                }
                , false));
            if (!manyModeRef.current) {
                SelectMode();
            }
        }

        ClientMediator.sendCommand("BattleMap", "SetArguments", { contextId: battleMapId, value: { onStart, onUpdate, onEnd } });
        ClientMediator.sendCommand("BattleMap", "SetOperationMode", { contextId: battleMapId, mode: BattleMapOperations.DISPLAY });
    }

    const SelectMode = () => {
        ClientMediator.sendCommand("BattleMap", "SetOperationMode", { contextId: battleMapId, mode: BattleMapOperations.SELECT });
        setManyMode(false);
        setAction("SELECT");
    }

    return (
        <DContainer title={"Add New Element"}>
            <Flex direction={'row'}>
                <DListItemToggleButton color={'gray'} isToggled={action == "ADDRECT"} selectedColor={manyMode ? 'gold' : 'white'} onClick={AddRect} variant="outline" label='Add Rect' icon={FaSquare} />
                <DListItemToggleButton color={'gray'} isToggled={action == "ADDCIRCLE"} selectedColor={manyMode ? 'gold' : 'white'} onClick={AddCircle} variant="outline" label='Add circle' icon={FaCircle} />
                <DListItemToggleButton color={'gray'} isToggled={action == "ADDTEXT"} selectedColor={manyMode ? 'gold' : 'white'} onClick={() => {
                    setAction("ADDTEXT");
                    setManyMode(action == "ADDTEXT");
                    AddElement(new fabric.IText("Text", { name: "Text" }))
                }} variant="outline" label='Add Text' icon={FaTextHeight} />
            </Flex>
            {action.startsWith("ADD") ?
                <>
                    <Divider marginTop={'5px'} marginBottom={'5px'} />
                    <Flex marginBottom={'5px'} direction={'row'}>
                    <DListItemToggleButton color={'gray'} selectedColor={'white'} isToggled={!options.alignToCenter && !options.alignToCorner} onClick={() => setOptions({ ...options, alignToCorner: false, alignToCenter: false })} variant="outline" label='No align' icon={IoMdClose} />
                        <DListItemToggleButton color={'gray'} selectedColor={'white'} isToggled={options.alignToCenter} onClick={() => setOptions({ ...options, alignToCorner: false, alignToCenter: true })} variant="outline" label='Align to center' icon={FaCircleNotch} />
                        <DListItemToggleButton color={'gray'} selectedColor={'white'} isToggled={options.alignToCorner} onClick={() => setOptions({ ...options, alignToCenter: false, alignToCorner: true })} variant="outline" label='Align to grid' icon={FaRulerCombined} />
                    </Flex>
                    <Flex direction={'row'}>
                        <table>
                            <tr><td style={{ verticalAlign: 'top' }}>Fill</td><td><ColorPicker color={options.fill} onChange={(fill) => setOptions({ ...options, fill })} /></td></tr>
                            <tr><td style={{ verticalAlign: 'top' }}>Outline</td><td><ColorPicker color={options.stroke} onChange={(stroke) => setOptions({ ...options, stroke })} /></td></tr>
                            <tr><td>Thickness</td><td><Input value={options.strokeWidth} onChange={(e) => setOptions({ ...options, strokeWidth: e.target.value })} /></td></tr>
                            <tr><td>Opacity</td><td><Input value={options.opacity} onChange={(e) => setOptions({ ...options, opacity: e.target.value })} /></td></tr>
                        </table>
                    </Flex>
                </>
                : <></>}
        </DContainer>
    );
}
export default AddNewElementToolsPanel;