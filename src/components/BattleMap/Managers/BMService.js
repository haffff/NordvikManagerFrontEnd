import WebSocketManagerInstance from "../../game/WebSocketManager";
import CommandFactory from "../Factories/CommandFactory";
import { fabric } from "fabric";
import DTOConverter from "../DTOConverter";
import ClientMediator from "../../../ClientMediator";
import { toaster } from "../../ui/toaster";

class BMService {
  _clipboard = undefined;
  _canvas = undefined;
  _reloadCommand = undefined;
  _changeMapCommand = undefined;
  _BMQueryService = undefined;
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
    this._canvas.sortLayers();
  }

  EditGrid({ isCommand}) {
    this._canvas.discardActiveObject();
    //this._canvas.editGridMode = true;
    //get .grid object
    let grid = this._canvas.getObjects().find((x) => x.name === ".grid");
    //set active object
    this._canvas.setActiveObject(grid);

    this._canvas.requestRenderAll();
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
    this._canvas.getObjects().forEach((object) => {
      object.set(
        "selectable",
        object.selectablePermission && object.layer === layerId
      );
    });

    const layerMode = withEditMode ? true : false;

    this.SetLayerEditMode({ editMode: layerMode, layer: layerId });

    ClientMediator.fireEvent("BattleMap_LayerChanged", {
      layer: layerId,
      withEditMode: layerMode,
      battleMapId: this.contextId,
    });
  }

  SetTokenSelectMode({
    minTokens,
    maxTokens,
    popupContent,
    overlayContent,
    isCommand,
  }) {
    const canvas = this._canvas;

    if (canvas.modeLock || canvas.editLock) {
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

    this.SetSelectedLayer({ layerId: 100, withEditMode: false });

    this._addPopupAndOverlay(overlayContent, popupContent);

    const objects = canvas.getObjects();

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

    ClientMediator.fireEvent("BattleMap_ModeChanged", {
      battleMapId: this.contextId,
      mode: "TokenSelect",
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

    this._removePopupAndOverlay();

    const objects = canvas.getObjects();

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

    ClientMediator.fireEvent("BattleMap_ModeChanged", {
      battleMapId: this.contextId,
      mode: undefined,
      modeType: undefined,
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
      canvas.editLock = true;

      canvas.getObjects().forEach((object) => {
        if (object.layer === layer) {
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
      canvas.editLock = false;
      canvas.editLayer = undefined;
      canvas.modeLock = undefined;
      canvas.getObjects().forEach((object) => {
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

    toaster.create({ title: "Copied", description: "Copied " + objects.length + " elements.", type: "success", duration: 5000 });
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

      toaster.create({ title: "Pasted", description: "Pasted " + this._clipboard.length + " elements.", type: "success", duration: 5000 });
    }
  }

  SetAlign({ align, isCommand }) {
    if (isCommand && !align) {
      return "align is required.";
    }

    ClientMediator.fireEvent("BattleMap_AlignChanged", { align, battleMapId: this.contextId });
    this._canvas.alignMode = align;
  }

  SetDragMode({ enabled, isCommand }) {
    if (isCommand && enabled === undefined) {
      return "enabled is required.";
    }

    if(this._canvas.dragModeLock)
    {
      return;
    }

    ClientMediator.fireEvent("BattleMap_DragModeChanged", { enabled, battleMapId: this.contextId });
    this._canvas.draggingMode = enabled ? true : undefined;
  }

  SetCreateElement({ element }) {
    if (this._canvas.simpleCreateMode) {
      this._canvas.simpleCreateElement = element;
    }
  }

  SetFreeDrawMode({ enabled, overlayContent, popupContent, isCommand, brush }) {
    if (isCommand && enabled === undefined) {
      return "enabled is required.";
    }

    const canvas = this._canvas;

    if (enabled) {
      if (canvas.modeLock) {
        console.warn("Mode is locked, cannot change free draw mode.");
        return;
      }

      canvas.modeLock = true;
      canvas.discardActiveObject();
      canvas.freeDrawMode = true;
      canvas.selection = false;

      this.SetDragMode({ enabled: false });
      canvas.dragModeLock = true;

      canvas.isDrawingMode = true;
      if (brush) {
        canvas.freeDrawingBrush = brush;
        canvas.freeDrawingBrush.initialize(canvas);
      } else {
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.width = 5;
        canvas.freeDrawingBrush.color = "rgba(0,0,0,1)";
      }

      canvas.on("path:created", this._path_created);

      this._addPopupAndOverlay(overlayContent, popupContent);

      canvas.getObjects().forEach((object) => {
        object.set("beforeFreeDrawSelectable", object.selectable);
        object.set("selectable", false);
      });

      ClientMediator.fireEvent("BattleMap_ModeChanged", {
        battleMapId: this.contextId,
        mode: "Draw",
      });
    } else {
      if (canvas.freeDrawMode) {
        canvas.modeLock = undefined;
        canvas.freeDrawMode = undefined;
        canvas.selection = true;

        canvas.isDrawingMode = false;
        canvas.freeDrawingBrush = undefined;
        canvas.dragModeLock = false;

        canvas.off("path:created", this._path_created);
        this._removePopupAndOverlay();

        canvas.getObjects().forEach((object) => {
          if (object.beforeFreeDrawSelectable !== undefined) {
            object.set("selectable", object.beforeFreeDrawSelectable);
            object.set("beforeFreeDrawSelectable", undefined);
          }
        });

        ClientMediator.fireEvent("BattleMap_ModeChanged", {
          battleMapId: this.contextId,
          mode: undefined,
          type: undefined,
        });
      }
    }
  }

  SetSimpleCreateMode({
    enabled,
    element,
    overlayContent,
    popupContent,
    type,
    withSizing,
  }) {
    const canvas = this._canvas;
    if (enabled) {
      if (canvas.modeLock) {
        console.warn("Mode is locked, cannot change simple create mode.");
        return;
      }

      canvas.modeLock = true;
      canvas.discardActiveObject();
      canvas.simpleCreateMode = true;
      canvas.simpleCreateElement = element;
      canvas.withSizing = withSizing;
      canvas.selection = false;
      canvas.modeType = type;

      this.SetDragMode({ enabled: false });
      canvas.dragModeLock = true;

      this._addPopupAndOverlay(overlayContent, popupContent);

      //ensure that object is in proper layer and has map id
      element.layer = canvas.selectedLayer;
      element.mapId = this._BMQueryService.GetSelectedMapID();

      canvas.getObjects().forEach((object) => {
        //save selectable state in other prop
        object.set("beforeSimpleCreateSelectable", object.selectable);
        object.set("selectable", false);
      });

      ClientMediator.fireEvent("BattleMap_ModeChanged", {
        battleMapId: this.contextId,
        mode: "SimpleCreate",
        type: canvas.modeType,
      });
    } else {
      if (canvas.simpleCreateMode) {
        canvas.modeLock = undefined;
        canvas.simpleCreateMode = undefined;
        canvas.simpleCreateElement = undefined;
        canvas.withSizing = undefined;
        canvas.selection = true;
        canvas.modeType = undefined;
        canvas.dragModeLock = false;

        this._removePopupAndOverlay();

        canvas.getObjects().forEach((object) => {
          if (object.beforeSimpleCreateSelectable !== undefined) {
            object.set("selectable", object.beforeSimpleCreateSelectable);
            object.set("beforeSimpleCreateSelectable", undefined);
          }
        });

        ClientMediator.fireEvent("BattleMap_ModeChanged", {
          battleMapId: this.contextId,
          mode: undefined,
          type: undefined,
        });
      }
    }
  }

  async SetMeasureMode({
    enabled,
    overlayContent,
    popupContent,
    type,
    isCommand,
    arrowObject,
    measureObject,
    additionalObject,
    playerColor,
  }) {
    if (isCommand && enabled === undefined) {
      return "enabled is required.";
    }

    const canvas = this._canvas;

    if (enabled) {
      if (canvas.modeLock) {
        console.warn("Mode is locked, cannot change measure mode.");
        return;
      }

      canvas.modeLock = true;
      canvas.discardActiveObject();
      canvas.measureMode = true;
      canvas.selection = false;
      canvas.modeType = type;
      canvas.measure = {
        visibleToOthers: true,
      };

      this.SetDragMode({ enabled: false });
      canvas.dragModeLock = true;

      canvas.measure.measureArrow =
        arrowObject ??
        new fabric.LineArrow([0, 0, 0, 0], {
          stroke: "rgba(0,0,0,1)",
          strokeWidth: 2,
          stroke: playerColor,
          selectable: false,
        });

      canvas.measure.measureObject =
        measureObject ??
        new fabric.Textbox("0", {
          left: 0,
          top: 0,
          width: 200,
          height: 90,
          fontSize: 56,
          fill: playerColor,
          selectable: false,
          editable: false,
        });

      let map = await ClientMediator.sendCommandAsync(
        "BattleMap",
        "GetSelectedMap",
        {
          contextId: this.contextId,
        }
      );

      canvas.measure.additionalObject = additionalObject ?? undefined;
      let unitArray = await ClientMediator.sendCommandAsync(
        "Properties",
        "GetByNames",
        { parentId: map.id ?? map.Id, names: ["baseDistanceUnit"] }
      );
      canvas.measure.units = unitArray[0]?.value ?? "ft";
      let realisticMeasureArray = await ClientMediator.sendCommandAsync(
        "Properties",
        "GetByNames",
        { parentId: map.id ?? map.Id, names: ["useSquaredSystem"] }
      );
      canvas.measure.realisticMeasure =
        realisticMeasureArray[0]?.value?.toLowerCase() === "true" ?? false;
      let distancePerSquareArray = await ClientMediator.sendCommandAsync(
        "Properties",
        "GetByNames",
        { parentId: map.id ?? map.Id, names: ["baseDistancePerSquare"] }
      );
      canvas.measure.distancePerSquare = distancePerSquareArray[0]?.value
        ? parseInt(distancePerSquareArray[0].value)
        : 5;

      this._addPopupAndOverlay(overlayContent, popupContent);

      canvas.getObjects().forEach((object) => {
        object.set("beforeMeasureSelectable", object.selectable);
        object.set("selectable", false);
      });

      ClientMediator.fireEvent("BattleMap_ModeChanged", {
        battleMapId: this.contextId,
        mode: "Measure",
        type: type,
      });
    } else {
      if (canvas.measureMode) {
        this.CleanPreviews();
        canvas.modeLock = undefined;
        canvas.measureMode = undefined;
        canvas.selection = true;
        canvas.modeType = undefined;
        canvas.measure = undefined;
        canvas.dragModeLock = false;

        this._removePopupAndOverlay();

        ClientMediator.fireEvent("BattleMap_ModeChanged", {
          battleMapId: this.contextId,
          mode: undefined,
          type: undefined,
        });

        canvas.requestRenderAll();
      }
    }
  }

  SetMeasureObjects({ arrowObject, additionalObject }) {
    const canvas = this._canvas;

    if (canvas.measureMode) {
      canvas.measure.measureArrow ??= arrowObject;
      canvas.measure.additionalObject ??= additionalObject;
    }
  }

  DisableAllModes() {
    this.SetSimpleCreateMode({ enabled: false });
    this.SetFreeDrawMode({ enabled: false });
    this.UnsetTokenSelectMode({});
    this.SetLayerEditMode({ editMode: false });
    this.SetMeasureMode({ enabled: false });
  }

  CleanPreviews() {
    const currentPlayer = ClientMediator.sendCommand("Game", "GetCurrentPlayer");
    const canvas = this._canvas;
    const filteredObjects = canvas.getObjects().filter((object) => object.previewId && object.playerId === currentPlayer.id);

    filteredObjects.forEach((object) => {
      canvas.remove(object);
    });
    if(canvas.measure.visibleToOthers === true)
    {
      WebSocketManagerInstance.Send({
        command: "preview_end",
        battleMapId: this.contextId,
        data: [
          filteredObjects.map((object) => ({ previewId: object.previewId, playerId: object.playerId })),
        ],
      });
    }



    canvas.requestRenderAll();
  }

  _addPopupAndOverlay(overlayContent, popupContent) {
    if (overlayContent) {
      ClientMediator.sendCommand("BattleMap", "ShowOverlay", {
        contextId: this.contextId,
        content: overlayContent,
      });
    }

    if (popupContent) {
      ClientMediator.sendCommand("BattleMap", "ShowPopup", {
        contextId: this.contextId,
        content: popupContent,
      });
    }
  }

  _removePopupAndOverlay() {
    ClientMediator.sendCommand("BattleMap", "HideOverlay", {
      contextId: this.contextId,
    });

    ClientMediator.sendCommand("BattleMap", "HidePopup", {
      contextId: this.contextId,
    });
  }
}

export default BMService;
