import * as React from 'react';
import { Divider, Flex } from '@chakra-ui/react'
import { fabric } from 'fabric';
import { FaRuler, FaDotCircle, FaEye, FaRulerCombined, FaAlignCenter, FaCentercode, FaCircleNotch, FaBorderNone, FaCross } from 'react-icons/fa'
import DListItem from '../../../uiComponents/base/List/DListItem';
import DListItemToggleButton from '../../../uiComponents/base/List/ListItemDetails/DListItemToggleButton';
import BattleMapOperations from '../../../BattleMap/BattlemapModes';
import WebSocketManagerInstance from '../../WebSocketManager';
import CommandFactory from '../../../BattleMap/Factories/CommandFactory';
import UtilityHelper from '../../../../helpers/UtilityHelper';
import DContainer from '../../../uiComponents/base/Containers/DContainer';
import { IoMdClose } from 'react-icons/io';
import ClientMediator from '../../../../ClientMediator';

export const RulersToolsPanel = ({ battleMapId, setAction, action, setManyMode, manyMode, map }) => {
    const [options, setOptions] = React.useState({
        visibleToOthers: true,
        alignToCenter: true,
        alignToCorner: false
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

    const calculateDistance = (x1, y1, x2, y2) => {
        let dx = x2 - x1;
        let dy = y2 - y1;
        let rawDistance = Math.sqrt(dx * dx + dy * dy) / map.gridSize;
        let distanceWithoutUnits = rawDistance.toFixed(0);
        let distanceWithUnits = distanceWithoutUnits * 5;
        ClientMediator.sendCommand("BattleMap", "SetPopup", { contextId: battleMapId , content: (<div>{distanceWithUnits} ft</div>) });
    }

    const PreviewRuler = () => {
        setAction("METER");

        var arrow = new fabric.LineArrow([0, 0, 0, 0], {
            strokeWidth: 5,
            fill: 'red',
            stroke: 'red',
            originX: 'center',
            originY: 'center',
            id: "preview_" + UtilityHelper.GenerateUUID(),
            isCreated: false,
        });

        const onStart = (coords, canvas) => {
            const { x, y } = calculateCoords(coords);

            arrow.set({ x1: x, y1: y, x2: x, y2: y });
            canvas.add(arrow);
            if (optionsRef.current.visibleToOthers) {
                WebSocketManagerInstance.Send(CommandFactory.CreatePreviewStartCommand(arrow, battleMapId));
            }
        }

        const onUpdate = (coords, canvas) => {
            const { x, y } = calculateCoords(coords);
            if (x == arrow.x2 && y == arrow.y2) {
                return;
            }

            arrow.set({ x2: x, y2: y });

            calculateDistance(arrow.x1, arrow.y1, arrow.x2, arrow.y2);
            if (optionsRef.current.visibleToOthers) {
                WebSocketManagerInstance.Send(CommandFactory.CreatePreviewUpdateCommand({ id: arrow.id, x1: arrow.x1, y1: arrow.y1, x2: x, y2: y }, battleMapId));
            }
        }

        const onEnd = (coords, canvas) => {
            canvas.remove(arrow);
            ClientMediator.sendCommand("BattleMap", "SetPopup", { contextId: battleMapId , content: undefined });
            if (optionsRef.current.visibleToOthers) {
                WebSocketManagerInstance.Send(CommandFactory.CreatePreviewEndCommand(arrow.id));
            }
        }
        
        ClientMediator.sendCommand("BattleMap", "SetArguments", { contextId: battleMapId, value: { onStart, onUpdate, onEnd } });
        ClientMediator.sendCommand("BattleMap", "SetOperationMode", { contextId: battleMapId, mode: BattleMapOperations.DISPLAY });
    }

    // const PreviewTriangleRuler = () => {
    //     setAction("TRIANGLEMETER")
    //     let triangle = new fabric.Triangle(
    //         {
    //             name: "Triangle",
    //             fill: 'red',
    //             opacity: 0.5,
    //             id: "preview_" + UtilityHelper.GenerateUUID()
    //         });
    //     var arrow = new fabric.LineArrow([0, 0, 0, 0], {
    //         strokeWidth: 5,
    //         fill: 'red',
    //         stroke: 'red',
    //         originX: 'center',
    //         originY: 'center',
    //         id: "preview_" + UtilityHelper.GenerateUUID()
    //     });

    //     const onStart = (coords, canvas) => {
    //         //triangle.originX = 'center';
    //         //triangle.originY = 'top';
    //         //triangle.left = coords.x;
    //         //triangle.top = coords.y;
    //         canvas.add(triangle);

    //         arrow.set({ left: coords.x, top: coords.y, x1: coords.x, y1: coords.y });
    //         battleMapContext.current.BattleMapServices.BMService.SetPopup((<div>Penis</div>));
    //         canvas.add(arrow);

    //         WebSocketManagerInstance.Send(CommandFactory.CreatePreviewStartCommand(arrow, battleMapId));
    //         WebSocketManagerInstance.Send(CommandFactory.CreatePreviewStartCommand(triangle, battleMapId));
    //     }

    //     const onUpdate = (coords, canvas) => {
    //         arrow.set({ x2: coords.x, y2: coords.y });

    //         // Calculate the triangle base length based on the line coordinates
    //         let baseLength = Math.abs(arrow.x2 - arrow.x1);

    //         // Calculate the triangle height (which is the line length)
    //         let height = Math.abs(arrow.y2 - arrow.y1);

    //         // Determine the triangle's left coordinate based on line orientation
    //         let left;
    //         if (arrow.x1 < arrow.x2) {
    //         left = arrow.x1; // Triangle points left if line goes left to right
    //         } else {
    //         left = arrow.x2; // Triangle points right if line goes right to left
    //         }
    //         let top = arrow.y2 + height

    //         triangle.set({left, top, height, width: baseLength});



    //         WebSocketManagerInstance.Send(CommandFactory.CreatePreviewUpdateCommand({ id: triangle.id, heigth: coords.x, width: coords.y }, battleMapId));
    //         WebSocketManagerInstance.Send(CommandFactory.CreatePreviewUpdateCommand({ id: arrow.id, x1: arrow.x1, y1: arrow.y1, x2: coords.x, y2: coords.y }, battleMapId));
    //     }

    //     const onEnd = (coords, canvas) => {
    //         canvas.remove(arrow);
    //         canvas.remove(triangle);
    //         battleMapContext.current.BattleMapServices.BMService.SetPopup(undefined);

    //         WebSocketManagerInstance.Send(CommandFactory.CreatePreviewEndCommand(arrow.id));
    //         WebSocketManagerInstance.Send(CommandFactory.CreatePreviewEndCommand(triangle.id));
    //     }

    //     battleMapContext.current.BattleMapServices.BMService.SetArguments({ onStart, onUpdate, onEnd });
    //     battleMapContext.current.BattleMapServices.BMService.SetOperationMode(BattleMapOperations.DISPLAY);
    // }


    const PreviewCircleRuler = () => {
        setAction("CIRCLEMETER")
        let circle = new fabric.Circle({
            name: "Circle", fill: 'red', opacity: 0.5,
            id: "preview_" + UtilityHelper.GenerateUUID()
        });
        var arrow = new fabric.LineArrow([0, 0, 0, 0], {
            strokeWidth: 5,
            fill: 'red',
            stroke: 'red',
            originX: 'center',
            originY: 'center',
            id: "preview_" + UtilityHelper.GenerateUUID()
        });

        const onStart = (coords, canvas) => {
            const { x, y } = calculateCoords(coords);
            circle.originX = 'center';
            circle.originY = 'center';
            circle.left = x;
            circle.top = y;
            canvas.add(circle);

            arrow.set({ left: x, top: y, x1: x, y1: y });
            canvas.add(arrow);

            if (optionsRef.current.visibleToOthers) {
                WebSocketManagerInstance.Send(CommandFactory.CreatePreviewStartCommand(arrow, battleMapId));
                WebSocketManagerInstance.Send(CommandFactory.CreatePreviewStartCommand(circle, battleMapId));
            }
        }

        const onUpdate = (coords, canvas) => {
            const { x, y } = calculateCoords(coords);
            if (x == arrow.x2 && y == arrow.y2) {
                return;
            }

            arrow.set({ x2: x, y2: y });
            let circX = x - circle.left;
            let circY = y - circle.top;
            let radius = Math.sqrt(circX ** 2 + circY ** 2);
            circle.set({ radius });

            calculateDistance(arrow.x1, arrow.y1, arrow.x2, arrow.y2);

            if (optionsRef.current.visibleToOthers) {
                WebSocketManagerInstance.Send(CommandFactory.CreatePreviewUpdateCommand({ id: circle.id, radius }, battleMapId));
                WebSocketManagerInstance.Send(CommandFactory.CreatePreviewUpdateCommand({ id: arrow.id, x1: arrow.x1, y1: arrow.y1, x2: x, y2: y }, battleMapId));
            }
        }

        const onEnd = (coords, canvas) => {
            canvas.remove(arrow);
            canvas.remove(circle);
            ClientMediator.sendCommand("BattleMap", "SetPopup", { contextId: battleMapId , content: undefined });
            

            if (optionsRef.current.visibleToOthers) {
                WebSocketManagerInstance.Send(CommandFactory.CreatePreviewEndCommand(arrow.id));
                WebSocketManagerInstance.Send(CommandFactory.CreatePreviewEndCommand(circle.id));
            }
        }

        ClientMediator.sendCommand("BattleMap", "SetArguments", { contextId: battleMapId, value: { onStart, onUpdate, onEnd } });
        ClientMediator.sendCommand("BattleMap", "SetOperationMode", { contextId: battleMapId, mode: BattleMapOperations.DISPLAY });
    }

    return (
        <DContainer title={"Ruler"}>
            <div>
                <DListItemToggleButton color={'gray'} selectedColor={'white'} isToggled={action == "METER"} onClick={PreviewRuler} variant="outline" label='Ruler' icon={FaRuler} />
                <DListItemToggleButton color={'gray'} selectedColor={'white'} isToggled={action == "CIRCLEMETER"} onClick={PreviewCircleRuler} variant="outline" label='Ruler' icon={FaDotCircle} />
                {/* <DListItemToggleButton color={'gray'} selectedColor={'white'} isToggled={action == "TRIANGLEMETER"} onClick={PreviewTriangleRuler} variant="outline" label='Ruler' icon={FaDotCircle} /> */}
            </div>
            {action.endsWith("METER") ?
                <>
                    <Divider marginTop={'5px'} marginBottom={'5px'} />
                    <Flex direction={'row'}>
                        <DListItemToggleButton color={'gray'} selectedColor={'white'} isToggled={options.visibleToOthers} onClick={() => setOptions({ ...options, visibleToOthers: !options.visibleToOthers })} variant="outline" label='Visible to others' icon={FaEye} />
                        <Divider orientation='vertical' marginLeft={2} marginRight={2} />
                        <DListItemToggleButton color={'gray'} selectedColor={'white'} isToggled={!options.alignToCenter && !options.alignToCorner} onClick={() => setOptions({ ...options, alignToCorner: false, alignToCenter: false })} variant="outline" label='No align' icon={IoMdClose} />
                        <DListItemToggleButton color={'gray'} selectedColor={'white'} isToggled={options.alignToCenter} onClick={() => setOptions({ ...options, alignToCorner: false, alignToCenter: true })} variant="outline" label='Align to center' icon={FaCircleNotch} />
                        <DListItemToggleButton color={'gray'} selectedColor={'white'} isToggled={options.alignToCorner} onClick={() => setOptions({ ...options, alignToCenter: false, alignToCorner: true })} variant="outline" label='Align to grid' icon={FaRulerCombined} />
                    </Flex>
                </>
                : <></>}

        </DContainer>

    );
}
export default RulersToolsPanel;