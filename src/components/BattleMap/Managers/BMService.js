import WebSocketManagerInstance from "../../game/WebSocketManager";
import CommandFactory from "../Factories/CommandFactory";
import { fabric } from 'fabric';
import DTOConverter from "../DTOConverter";

class BMService {
    _clipboard = undefined;
    _canvas = undefined;
    _refreshCommand = undefined;
    _reloadCommand = undefined;
    _changeMapCommand = undefined;
    _BMQueryService = undefined;
    _setSelectedLayerCommand = undefined;
    _setPopupContent = undefined;
    _popupVisible = undefined;
    _operationModeRef = undefined;
    _argumentsRef = undefined;
    _isPreviewModel = false;
    _battleMapModel = undefined;

    Load() {
        this.panel = "battlemap";
        this.contextId = this._battleMapModel.id;
        this.id = "BMService" + this._battleMapModel.id;
    }

    GroupSelected() {
        let selectedObjects = this._BMQueryService.GetSelectedObjects();

        //filter ungrouped objects
        let objectsToAdd = selectedObjects.filter(x => x._objects === undefined);
        if (selectedObjects !== undefined) {
            let mapId = this._BMQueryService.GetSelectedMapID();
            let coords = this._BMQueryService.GetSelectedGroupCoords();
            let group = new fabric.Group(objectsToAdd, {
                originX: 'left',
                originY: 'top',
                left: coords[0].x,
                top: coords[0].y,
                layer: objectsToAdd[0].layer
            }).setObjectsCoords().setCoords();
            let cmd = CommandFactory.CreateGroupCommand({ object: JSON.stringify(group), mapId: mapId, layer: selectedObjects[0].layer }, selectedObjects.map(x => x.id));
            WebSocketManagerInstance.Send(cmd);
        }
    }

    ///Refresh battlemap view without needing to reload the elements
    RefreshBattleMapComponent() {
        this._refreshCommand();
    }

    ///Reload whole battlemap(for example. map change)
    ReloadBattleMapComponent() {
        this._reloadCommand();
    }

    ChangeMap({id}) {
        this._changeMapCommand(id);
    }

    //Not working properly, need a fix
    UngroupSelected() {
        let selectedObjects = this._BMQueryService.GetSelectedObjects();
        let mapId = this._BMQueryService.GetSelectedMapID();
        if (selectedObjects !== undefined && selectedObjects.length == 1) {
            let children = selectedObjects[0]._objects.map(element => {
                let coords = this._BMQueryService.GetSelectedGroupCoords()[0];
                element.left = element.aCoords.tl.x + coords.x;
                element.top = element.aCoords.tl.y + coords.y;
                element.layer = selectedObjects[0].layer;
                return DTOConverter.ConvertToDTO(element);
            });

            let cmd = CommandFactory.CreateUngroupCommand(selectedObjects[0].id, children);
            WebSocketManagerInstance.Send(cmd);
        }
    }

    RemoveSelected() {
        let selectedObjects = this._BMQueryService.GetSelectedObjects();
        if (selectedObjects !== undefined) {
            selectedObjects.forEach(element => {
                let cmd = CommandFactory.CreateDeleteCommand(element);
                WebSocketManagerInstance.Send(cmd);
            });
        }
    }

    SortLayers() {
        this._canvas._objects.sort((a, b) => (a.layer > b.layer || a.insideLayerIndex > b.insideLayerIndex) ? 1 : -1);
        this._canvas.renderAll();
    }

    SetSelectedLayer({ layerId, withEditMode, isCommand }) {
        if(isCommand && !layerId) {
            return "layerId is required.";
        }

        this._setSelectedLayerCommand(layerId);
        this._canvas._objects.forEach((object) => {
            object.set("selectable", object.selectablePermission && object.layer === layerId);
        });

        this.SetLayerEditMode({ editMode: withEditMode, layer: layerId });
    }

    SetLayerEditMode({ editMode, layer, isCommand }) {
        if(isCommand && editMode === undefined) {
            return "editMode is required.";
        }
        
        this._canvas.discardActiveObject();
        this._canvas._objects.forEach(object => {
            if (editMode && object.layer !== layer) {
                if (object.otherLayerEdit !== undefined) {
                    return;
                }

                object.set("origOpacity", object.opacity);
                object.set("opacity", object.opacity - 0.5);
                object.set("otherLayerEdit", true);
            }
            else {
                if (object.origOpacity) {
                    object.set("opacity", object.origOpacity);
                    object.set("origOpacity", undefined);
                }
                object.set("otherLayerEdit", undefined);
            }
        });
        this._canvas.requestRenderAll();
    }

    SetOperationMode({ mode, isCommand }) {
        if(isCommand && mode === undefined) {
            return "mode is required.";
        }
        this._operationModeRef.current = mode;
    }

    SetArguments({value}) {
        this._argumentsRef.current = value;
    }

    SetPopup({content}) {
        if (content) {
            this._popupVisible.current = true;
        }
        else {
            this._popupVisible.current = false;
        }

        this._setPopupContent(content);
    }

    CopyElements() {
        let objects = this._BMQueryService.GetSelectedObjects();
        this._canvas.discardActiveObject();
        let mapped = objects.map(element => {
            let cloned = fabric.util.object.clone(element);
            return cloned;
        });

        this._clipboard = mapped;

        var sel = new fabric.ActiveSelection(objects, {
            canvas: this._canvas,
        });
        this._canvas.setActiveObject(sel);
    }

    PasteElements({coords, isCommand, x, y}) {
        if(isCommand && !x && !y) {
            return "x and y are required.";
        }
        if(isCommand)
        {
            coords = { x, y };
        }
        
        if (this._clipboard !== undefined) {
            // active selection needs a reference to the canvas.
            this._clipboard.forEach(element => {

                if (coords) {
                    element.left = coords.x;
                    element.top = coords.y;
                }
                else {
                    element.left += 10;
                    element.top += 10;
                }

                let dto = DTOConverter.ConvertToDTO(element);
                let cmd = CommandFactory.CreateAddCommand({ ...dto, layer: this._BMQueryService.GetSelectedLayer(), mapId: this._BMQueryService.GetSelectedMapID() }, true);
                WebSocketManagerInstance.Send(cmd);
            });
        }
    }
}

export default BMService;
