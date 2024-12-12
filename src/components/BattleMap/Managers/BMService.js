import WebSocketManagerInstance from "../../game/WebSocketManager";
import CommandFactory from "../Factories/CommandFactory";
import { fabric } from "fabric";
import DTOConverter from "../DTOConverter";
import ClientMediator from "../../../ClientMediator";

class BMService {
  _clipboard = undefined;
  _canvas = undefined;
  _reloadCommand = undefined;
  _changeMapCommand = undefined;
  _BMQueryService = undefined;
  _isPreviewModel = false;
  _battleMapModel = undefined;
  _contextMenuRef = undefined;

  Load() {
    this.panel = "battlemap";
    this.contextId = this._battleMapModel.id;
    this.id = "BMService" + this._battleMapModel.id;
  }

  GroupSelected() {
    let selectedObjects = this._BMQueryService.GetSelectedObjects();

    //filter ungrouped objects
    let objectsToAdd = selectedObjects.filter((x) => x._objects === undefined);
    if (selectedObjects !== undefined) {
      let mapId = this._BMQueryService.GetSelectedMapID();
      let coords = this._BMQueryService.GetSelectedGroupCoords();
      let group = new fabric.Group(objectsToAdd, {
        originX: "left",
        originY: "top",
        left: coords[0].x,
        top: coords[0].y,
        layer: objectsToAdd[0].layer,
      })
        .setObjectsCoords()
        .setCoords();
      let cmd = CommandFactory.CreateGroupCommand(
        {
          object: JSON.stringify(group),
          mapId: mapId,
          layer: selectedObjects[0].layer,
        },
        selectedObjects.map((x) => x.id)
      );
      WebSocketManagerInstance.Send(cmd);
    }
  }

  ///Reload whole battlemap(for example. map change)
  ReloadBattleMapComponent() {
    this._reloadCommand();
  }

  ChangeMap({ id }) {
    this._changeMapCommand(id);
  }

  //Not working properly, need a fix
  UngroupSelected() {
    let selectedObjects = this._BMQueryService.GetSelectedObjects();
    let mapId = this._BMQueryService.GetSelectedMapID();
    if (selectedObjects !== undefined && selectedObjects.length == 1) {
      let children = selectedObjects[0]._objects.map((element) => {
        let coords = this._BMQueryService.GetSelectedGroupCoords()[0];
        element.left = element.aCoords.tl.x + coords.x;
        element.top = element.aCoords.tl.y + coords.y;
        element.layer = selectedObjects[0].layer;
        return DTOConverter.ConvertToDTO(element);
      });

      let cmd = CommandFactory.CreateUngroupCommand(
        selectedObjects[0].id,
        children
      );
      WebSocketManagerInstance.Send(cmd);
    }
  }

  RemoveSelected() {
    let selectedObjects = this._BMQueryService.GetSelectedObjects();
    if (selectedObjects !== undefined) {
      selectedObjects.forEach((element) => {
        let cmd = CommandFactory.CreateDeleteCommand(element);
        WebSocketManagerInstance.Send(cmd);
      });
    }
  }

  SortLayers() {
    this._canvas._objects.sort((a, b) =>
      a.layer > b.layer || a.insideLayerIndex > b.insideLayerIndex ? 1 : -1
    );
    this._canvas.renderAll();
  }

  SetSelectedLayer({ layerId, withEditMode, isCommand }) {
    if (isCommand && !layerId) {
      return "layerId is required.";
    }

    if (this._canvas.modeLock && !this._canvas.editMode) {
      console.warn("Mode is locked, cannot change layer.");
      return;
    }

    this._canvas.selectedLayer = layerId;
    this._canvas._objects.forEach((object) => {
      object.set(
        "selectable",
        object.selectablePermission && object.layer === layerId
      );
    });

    const layerMode = withEditMode ? true : false;

    this.SetLayerEditMode({ editMode: layerMode, layer: layerId });
  }

  SetTokenSelectMode({ minTokens, maxTokens, message, isCommand }) {
    const canvas = this._canvas;

    if (canvas.modeLock) {
      console.warn("Mode is locked, cannot change token select mode.");
      return;
    }

    canvas.tokenSelectMode = true;
    canvas.modeLock = true;
    canvas.contextMenuLock = true;
    canvas.discardActiveObject();
    canvas.minTokens = minTokens ?? 1;
    canvas.maxTokens = maxTokens ?? 1;
    canvas.tokens = [];
    canvas.tokenSelectMessage = message;

    this.SetSelectedLayer({ layerId: 100, withEditMode:false });

    ClientMediator.sendCommand("BattleMap", "ShowPopup", {contextId: this.contextId ,content: `${canvas.tokenSelectMessage}. Tokens selected: ${canvas.tokens.length}/${canvas.maxTokens}`});

    const objects = canvas._objects;

    objects.forEach((object) => {
      object.set("beforeTokenSelectSelectable", object.selectable);
      object.set("selectable", false);

      object.set("beforeTokenSelectEditable", object.editable);
      object.set("editable", false);

      if (object.tokenData) {
        object.set("beforeTokenSelectOpacity", object.opacity);
        object.set("opacity", 1);
      } else {
        object.set("beforeTokenSelectOpacity", object.opacity);
        object.set("opacity", 0.4);
      }
    });
  }

  UnsetTokenSelectMode({ isCommand }) {
    const canvas = this._canvas;

    if (!canvas.modeLock || !canvas.tokenSelectMode) {
      console.warn("Cannot unset token select mode.");
      return;
    }

    canvas.tokenSelectMode = undefined;
    canvas.modeLock = undefined;
    canvas.contextMenuLock = undefined;
    canvas.minTokens = undefined;
    canvas.maxTokens = undefined;
    canvas.tokens = undefined;
    canvas.tokenSelectMessage = undefined;

    ClientMediator.sendCommand("BattleMap", "HidePopup", {contextId: this.contextId});

    const objects = canvas._objects;

    objects.forEach((object) => {
      object.set("selectable", object.beforeTokenSelectSelectable);
      object.set("beforeTokenSelectSelectable", undefined);

      object.set("editable", object.beforeTokenSelectEditable);
      object.set("beforeTokenSelectEditable", undefined);

      if (object.tokenData) {
        object.set("opacity", object.beforeTokenSelectOpacity);
        object.set("beforeTokenSelectOpacity", undefined);
      } else {
        object.set("opacity", object.beforeTokenSelectOpacity);
        object.set("beforeTokenSelectOpacity", undefined);
      }
    });
  }

  SetLayerEditMode({ editMode, layer, isCommand }) {
    if (isCommand && (editMode === undefined || layer === undefined)) {
      return "--editMode and --layer is required.";
    }

    if (layer === undefined || editMode === undefined) {
      return;
    }

    const canvas = this._canvas;

    if (canvas.editMode === editMode && canvas.editLayer === layer) {
      return;
    }

    canvas.discardActiveObject();

    if (editMode) {
      canvas.editMode = editMode;
      canvas.editLayer = layer;
      canvas.modeLock = true;

      canvas._objects.forEach((object) => {
        if (object.editLayer === layer) {
          if (object.currentlyEdited !== undefined) {
            return;
          }

          if (object.origOpacity) {
            object.set("opacity", object.origOpacity);
            object.set("origOpacity", undefined);
          }
        } else {
          if (object.origOpacity === undefined) {
            object.set("origOpacity", object.opacity);
            object.set("opacity", object.opacity - 0.5);
          }
          object.set("currentlyEdited", undefined);
        }
      });
    } else {
      canvas.editMode = undefined;
      canvas.editLayer = undefined;
      canvas.modeLock = undefined;
      canvas._objects.forEach((object) => {
        if (object.origOpacity) {
          object.set("opacity", object.origOpacity);
          object.set("origOpacity", undefined);
        }
        object.set("currentlyEdited", undefined);
      });
    }

    canvas.requestRenderAll();
  }

  CopyElements() {
    let objects = this._BMQueryService.GetSelectedObjects();
    this._canvas.discardActiveObject();
    let mapped = objects.map((element) => {
      let cloned = fabric.util.object.clone(element);
      return cloned;
    });

    this._clipboard = mapped;

    var sel = new fabric.ActiveSelection(objects, {
      canvas: this._canvas,
    });
    this._canvas.setActiveObject(sel);
  }

  PasteElements({ coords, isCommand, x, y }) {
    if (isCommand && !x && !y) {
      return "x and y are required.";
    }
    if (isCommand) {
      coords = { x, y };
    }

    if (this._clipboard !== undefined) {
      // active selection needs a reference to the canvas.
      this._clipboard.forEach((element) => {
        if (coords) {
          element.left = coords.x;
          element.top = coords.y;
        } else {
          element.left += 10;
          element.top += 10;
        }

        let dto = DTOConverter.ConvertToDTO(element);
        let cmd = CommandFactory.CreateAddCommand(
          {
            ...dto,
            layer: this._BMQueryService.GetSelectedLayer(),
            mapId: this._BMQueryService.GetSelectedMapID(),
          },
          true
        );
        WebSocketManagerInstance.Send(cmd);
      });
    }
  }

  SetAlign({ align, isCommand }) {
    if (isCommand && !align) {
      return "align is required.";
    }

    ClientMediator.fireEvent("BattleMap_AlignChanged", {align});
    this._canvas.align = align;
  }

  SetDragMode({ enabled, isCommand }) {
    if (isCommand && enabled === undefined) {
      return "enabled is required.";
    }

    ClientMediator.fireEvent("BattleMap_DragModeChanged", {enabled});
    this._canvas.draggingMode = enabled ? true : undefined;
  }

  ShowContextMenu({ x, y, isCommand }) {
    if (isCommand && !x && !y) {
      return "x and y are required.";
    }

    if(this._canvas.contextMenuLock) {
      return;
    }

    let clientRect = this._contextMenuRef.current.parentElement.getBoundingClientRect();
    this._contextMenuRef.current.style.left = `${x - clientRect.x}px`;
    this._contextMenuRef.current.style.top = `${y - clientRect.y}px`;

    this._contextMenuRef.current.style.display = "block";

    this._canvas.isContextMenuVisible = true;
  }

  HideContextMenu() {
    this._contextMenuRef.current.style.display = "none";
    this._canvas.isContextMenuVisible = undefined;
  }

  SetSimpleCreateMode({ enabled, element, withSizing })
  {
    const canvas = this._canvas;
    if(enabled)
    {
      if(canvas.modeLock)
      {
        console.warn("Mode is locked, cannot change simple create mode.");
        return;
      }
      canvas.modeLock = true;
      canvas.discardActiveObject();
      canvas.simpleCreateMode = true;
      canvas.simpleCreateElement = element;
      canvas.withSizing = withSizing;

      canvas._objects.forEach((object) => {
        //save selectable state in other prop
        object.set("beforeSimpleCreateSelectable", object.selectable);
        object.set("selectable", false);
      });
    }
    else
    {
      this._isPreviewModel = false;
      this._canvas.remove(this._canvas._objects[this._canvas._objects.length - 1]);
    }
  }
}

export default BMService;
