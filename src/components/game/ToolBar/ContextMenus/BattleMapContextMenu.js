import { FormLabel } from '@chakra-ui/react';
import * as React from 'react';
import { DropDownMenu } from '../../../uiComponents/base/DDItems/DropDownMenu';
import { DropDownItem } from '../../../uiComponents/base/DDItems/DropDownItem';
import { FaArrowAltCircleDown, FaArrowAltCircleUp, FaChess, FaCog, FaCopy, FaEye, FaLayerGroup, FaMap, FaObjectUngroup, FaPaste, FaPlus, FaTrash, FaWrench } from 'react-icons/fa';
import Loadable from '../../../uiComponents/base/Loadable';
import DTOConverter from '../../../BattleMap/DTOConverter';
import WebSocketManagerInstance from '../../WebSocketManager';
import ClientMediator from '../../../../ClientMediator';

export const BattleMapContextMenu = ({ loaded, width, battleMapId, canvas, contextMenuReference }) => {
    if (!canvas) {
        return;
    }
    const selectedObjects = canvas.getActiveObjects();

    const OnLoad = (finished) => {
        finished();
    }

    const HandleDelete = () => {
        ClientMediator.sendCommand("BattleMap", "RemoveSelected", { contextId: battleMapId });
    }

    const HandleSpawnProperties = () => {
        ClientMediator.sendCommand("Game", "CreateNewPanel", { type: "PropertiesPanel", battleMapId, props: {map: ClientMediator.sendCommand("BattleMap", "GetSelectedMap", { contextId: battleMapId })} });
    }

    const HandleSpawnBattleMap = () => {
        WebSocketManagerInstance.Send({ command: "show_battlemap", data: battleMapId });
    }

    const HandleSpawnMapSettings = () => {
        ClientMediator.sendCommand("Game", "CreateNewPanel", { type: "MapSettingsPanel", battleMapId, props: {map: ClientMediator.sendCommand("BattleMap", "GetSelectedMap", { contextId: battleMapId })} });
    }

    const HandleSpawnTools = () => {
        ClientMediator.sendCommand("Game", "CreateNewPanel", { type: "ToolsPanel", battleMapId, props: {map: ClientMediator.sendCommand("BattleMap", "GetSelectedMap", { contextId: battleMapId })} });
    }

    const PasteElements = () => {
        return ClientMediator.sendCommand("BattleMap", "PasteElements", { contextId: battleMapId, coords: canvas.lastAbsolutePointer });
    }

    const CopyElements = () => {
        return ClientMediator.sendCommand("BattleMap", "CopyElements", { contextId: battleMapId });
    }

    const SwitchLayer = (layer) => {
        var dto = DTOConverter.ConvertToDTO(selectedObjects[0]);
        dto.layer = layer;
        dto.insideLayerIndex = 0;
        WebSocketManagerInstance.Send({ command: "element_update", data: DTOConverter.ConvertToDTO(dto), action: "layer" });
    }

    const MoveUp = () => {
        if (!selectedObjects[0].insideLayerIndex) {
            selectedObjects[0].insideLayerIndex = 1;
        }
        else {
            selectedObjects[0].insideLayerIndex++;
        }

        WebSocketManagerInstance.Send({ command: "element_update", data: DTOConverter.ConvertToDTO(selectedObjects[0]), action: "layer" });
    }

    const MoveDown = () => {
        if (!selectedObjects[0].insideLayerIndex) {
            selectedObjects[0].insideLayerIndex = -1;
        }
        else {
            selectedObjects[0].insideLayerIndex--;
        }

        WebSocketManagerInstance.Send({ command: "element_update", data: DTOConverter.ConvertToDTO(selectedObjects[0]), action: "layer" });
    }

    width = width || 150;

    return (
        <div style={{ backgroundColor: 'rgb(40,40,40)', width: "150px" }}>
            <Loadable OnLoad={OnLoad}>
                {selectedObjects && selectedObjects.length === 1 ? (
                    <>
                        <FormLabel style={{ textAlign: 'center', alignItems: 'center', justifyContent: 'center' }}>{selectedObjects[0].name}</FormLabel>
                        <DropDownItem width={width} name={"Delete"} icon={FaTrash} onClick={HandleDelete} />
                        <DropDownItem width={width} name={"Copy"} icon={FaCopy} onClick={CopyElements} />
                        <DropDownItem width={width} name={"Paste"} icon={FaPaste} onClick={PasteElements} />
                        <DropDownMenu submenu={true} width={width} name={"More Actions"}>
                            <DropDownItem width={width} name={"Ungroup"} onClick={() => SwitchLayer(-100)} icon={FaObjectUngroup} />
                            <DropDownItem width={width} name={"Move Up"} onClick={() => MoveUp()} icon={FaArrowAltCircleUp} />
                            <DropDownItem width={width} name={"Move Down"} onClick={() => MoveDown()} icon={FaArrowAltCircleDown} />
                        </DropDownMenu>
                        <DropDownMenu submenu={true} width={width} name={"Move to layer"} icon={FaLayerGroup}>
                            <DropDownItem width={width} name={"Token"} onClick={() => SwitchLayer(100)} icon={FaChess} />
                            <DropDownItem width={width} name={"Background"} onClick={() => SwitchLayer(-100)} icon={FaMap} />
                        </DropDownMenu>
                        <DropDownItem width={width} name={"Properties"} onClick={HandleSpawnProperties} icon={FaWrench} />
                    </>
                ) : <>
                    <DropDownMenu expandableLocationName={"context_menu_add"} expandableWithAction submenu={true} width={width} name={"Add"} icon={FaPlus}>

                    </DropDownMenu>
                    <DropDownItem width={width} name={"Paste"} icon={FaPaste} onClick={() => PasteElements()} />
                    <DropDownMenu expandableLocationName={"context_menu_battlemap"} expandableWithAction submenu={true} width={width} name={"Battle Map"} icon={FaMap}>
                        <DropDownItem width={width} name={"Show"} onClick={HandleSpawnBattleMap} icon={FaEye} />
                        <DropDownItem width={width} name={"Tools"} onClick={HandleSpawnTools} icon={FaWrench} />
                    </DropDownMenu>
                    <DropDownItem width={width} name={"Map Settings"} onClick={HandleSpawnMapSettings} icon={FaCog} />
                </>}
            </Loadable>
        </div>
    );
}
export default BattleMapContextMenu;