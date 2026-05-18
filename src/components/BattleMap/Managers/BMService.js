import { ActiveTransportManager as WebSocketManagerInstance } from "../../../helpers/transport";
import CommandFactory from "../Factories/CommandFactory";
import { fabric } from "fabric";
import DTOConverter from "../DTOConverter";
import ClientMediator from "../../../ClientMediator";
import { toaster } from "../../ui/toaster";
import UtilityHelper from "../../../helpers/UtilityHelper";
import ConeTypeInit from "../../uiComponents/fabricjs/ConeType";

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

  // ── $meta ────────────────────────────────────────────────────────────────────
  // Picked up by CommandExecutionHelper.LoadSuggestions via prototype reflection.
  get $meta() {
    return {
      GroupSelected: {
        description: 'Groups the currently selected objects into a single fabric Group.',
        args: [],
      },
      UngroupSelected: {
        description: 'Ungroups the selected group back into individual objects. (WIP)',
        args: [],
      },
      RemoveSelected: {
        description: 'Deletes all currently selected objects from the map.',
        args: [],
      },
      ReloadBattleMapComponent: {
        description: 'Fully reloads the BattleMap component (e.g. after a map change).',
        args: [],
      },
      ChangeMap: {
        description: 'Requests a map switch via the server (persists + broadcasts to all clients). Required: id (map id)',
        args: [{ name: 'id', type: 'mapid', required: true }],
      },
      ApplyMapChange: {
        description: 'Applies a server-confirmed map change locally (reloads canvas). Called by OnMapChange handler — do not call directly from UI.',
        args: [{ name: 'id', type: 'mapid', required: true }],
      },
      UpdateMapReference: {
        description: 'Merges new settings into the live map reference held by BMQueryService.',
        args: [{ name: 'mapData', type: 'object', required: true }],
      },
      SortLayers: {
        description: 'Re-sorts all canvas objects by their layer value.',
        args: [],
      },
      EditGrid: {
        description: 'Selects the grid object so it can be edited.',
        args: [],
      },
      SetSelectedLayer: {
        description: 'Sets the active layer. Optionally enables edit-mode for that layer.',
        args: [
          { name: 'layerId', type: 'number', required: true },
          { name: 'withEditMode', type: 'boolean', required: false },
        ],
      },
      SetLayerEditMode: {
        description: 'Enables or disables edit-mode for a layer, fading objects on other layers.',
        args: [
          { name: 'editMode', type: 'boolean', required: true },
          { name: 'layer', type: 'number', required: true },
        ],
      },
      SetTokenSelectMode: {
        description: 'Locks the canvas into token-selection mode with optional min/max token count.',
        args: [
          { name: 'minTokens', type: 'number', required: false },
          { name: 'maxTokens', type: 'number', required: false },
        ],
      },
      UnsetTokenSelectMode: {
        description: 'Exits token-selection mode and restores object selectability.',
        args: [],
      },
      CopyElements: {
        description: 'Copies selected canvas objects to the internal clipboard.',
        args: [],
      },
      PasteElements: {
        description: 'Pastes clipboard objects at the given coordinates (or offset by 10px).',
        args: [
          { name: 'x', type: 'number', required: false },
          { name: 'y', type: 'number', required: false },
        ],
      },
      SetAlign: {
        description: 'Sets the snap-align mode (e.g. "grid", "object", or undefined to disable).',
        args: [{ name: 'align', type: 'string', required: true }],
      },
      SetDragMode: {
        description: 'Enables or disables canvas pan/drag mode.',
        args: [{ name: 'enabled', type: 'boolean', required: true }],
      },
      SetFreeDrawMode: {
        description: 'Enables or disables freehand pencil-draw mode.',
        args: [{ name: 'enabled', type: 'boolean', required: true }],
      },
      SetSimpleCreateMode: {
        description: 'Enables or disables simple-click-to-place creation mode for a canvas element.',
        args: [
          { name: 'enabled', type: 'boolean', required: true },
          { name: 'type', type: 'string', required: false },
          { name: 'withSizing', type: 'boolean', required: false },
        ],
      },
      SetMeasureMode: {
        description: 'Enables or disables distance-measurement mode, loading grid/unit settings from the server.',
        args: [
          { name: 'enabled', type: 'boolean', required: true },
          { name: 'type', type: 'string', required: false },
        ],
      },
      DisableAllModes: {
        description: 'Exits all active canvas modes (draw, measure, token-select, edit-layer, etc.).',
        args: [],
      },
      CleanPreviews: {
        description: 'Removes all preview objects belonging to the current player from the canvas.',
        args: [],
      },
    };
  }

  GroupSelected() {
    const selectedObjects = this._BMQueryService.GetSelectedObjects();
    if (!selectedObjects?.length) return;

    // filter ungrouped objects
    const objectsToAdd = selectedObjects.filter((x) => x._objects === undefined);
    const mapId = this._BMQueryService.GetSelectedMapID();
    const coords = this._BMQueryService.GetSelectedGroupCoords();
    const group = new fabric.Group(objectsToAdd, {
      originX: "left",
      originY: "top",
      left: coords[0].x,
      top: coords[0].y,
      layer: objectsToAdd[0].layer,
    })
      .setObjectsCoords()
      .setCoords();
    const cmd = CommandFactory.CreateGroupCommand(
      {
        object: JSON.stringify(group),
        mapId: mapId,
        layer: selectedObjects[0].layer,
      },
      selectedObjects.map((x) => x.id)
    );
    WebSocketManagerInstance.Send(cmd);
  }

  ///Reload whole battlemap(for example. map change)
  ReloadBattleMapComponent() {
    this._reloadCommand();
  }

  ChangeMap(idOrObj) {
    const id = idOrObj?.id ?? idOrObj?.mapId ?? idOrObj;
    if (!id) return `ChangeMap: no map id provided`;
    const battleMapId = this._battleMapModel?.id;
    if (!battleMapId) return `ChangeMap: battlemap not loaded yet`;
    WebSocketManagerInstance.Send(CommandFactory.CreateChangeMapCommand(id, battleMapId));
  }

  ApplyMapChange(idOrObj) {
    const id = idOrObj?.id ?? idOrObj?.mapId ?? idOrObj;
    if (!id) return `ApplyMapChange: no map id provided`;
    if (typeof this._changeMapCommand !== 'function') return `ApplyMapChange: not ready (canvas not loaded yet)`;
    return this._changeMapCommand(id);
  }
  UpdateMapReference({ mapData }) {
    // Update the map reference in BMQueryService with new settings
    if (this._BMQueryService && this._BMQueryService._map) {
      Object.assign(this._BMQueryService._map, mapData);
    }
  }
  //Not working properly, need a fix
  UngroupSelected() {
    const selectedObjects = this._BMQueryService.GetSelectedObjects();
    if (selectedObjects !== undefined && selectedObjects.length == 1) {
      // Resolve coords once outside the map loop
      const groupCoords = this._BMQueryService.GetSelectedGroupCoords()[0];
      const children = selectedObjects[0]._objects.map((element) => {
        element.left = element.aCoords.tl.x + groupCoords.x;
        element.top = element.aCoords.tl.y + groupCoords.y;
        element.layer = selectedObjects[0].layer;
        return DTOConverter.ConvertToDTO(element);
      });

      const cmd = CommandFactory.CreateUngroupCommand(
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

    canvas.getObjects().forEach((object) => {
      const isToken = !!object.tokenData;
      object.set({
        beforeTokenSelectSelectable: object.selectable,
        selectable: false,
        beforeTokenSelectEditable: object.editable,
        editable: false,
        beforeTokenSelectOpacity: object.opacity,
        opacity: isToken ? 1 : 0.4,
      });
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

    canvas.getObjects().forEach((object) => {
      object.set({
        selectable: object.beforeTokenSelectSelectable,
        beforeTokenSelectSelectable: undefined,
        editable: object.beforeTokenSelectEditable,
        beforeTokenSelectEditable: undefined,
        opacity: object.beforeTokenSelectOpacity,
        beforeTokenSelectOpacity: undefined,
      });
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
          if (object.currentlyEdited !== undefined) return;
          if (object.origOpacity) {
            object.set({ opacity: object.origOpacity, origOpacity: undefined });
          }
        } else {
          if (object.origOpacity === undefined) {
            object.set({ origOpacity: object.opacity, opacity: object.opacity - 0.5 });
          }
          object.set("currentlyEdited", undefined);
        }
      });
    } else {
      canvas.editMode = undefined;   // clear editMode so the early-exit check works next time
      canvas.editLock = false;
      canvas.editLayer = undefined;
      canvas.modeLock = undefined;
      canvas.getObjects().forEach((object) => {
        if (object.origOpacity) {
          object.set({ opacity: object.origOpacity, origOpacity: undefined });
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
      // Resolve layer and mapId once — not per element
      const layer = this._BMQueryService.GetSelectedLayer();
      const mapId = this._BMQueryService.GetSelectedMapID();

      this._clipboard.forEach((element) => {
        if (coords) {
          element.left = coords.x;
          element.top = coords.y;
        } else {
          element.left += 10;
          element.top += 10;
        }

        const dto = DTOConverter.ConvertToDTO(element);
        const cmd = CommandFactory.CreateAddCommand(
          { ...dto, layer, mapId },
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
        canvas.freeDrawingBrush.fill = "rgba(0,0,0,1)";
        canvas.freeDrawingBrush.initialize(canvas);
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
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'crosshair';

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
        canvas.defaultCursor = 'default';
        canvas.hoverCursor = 'move';

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
      canvas.measure = { visibleToOthers: true };

      this.SetDragMode({ enabled: false });
      canvas.dragModeLock = true;

      canvas.measure.measureType = type ?? 'Line';

      // Build a semi-transparent fill from the player color
      const fillColor = (() => {
        try {
          const c = new fabric.Color(playerColor);
          c.setAlpha(0.2);
          return c.toRgba();
        } catch {
          return 'rgba(255,255,255,0.2)';
        }
      })();

      if (type === 'Circle') {
        canvas.measure.measureArrow = arrowObject ?? new fabric.Circle({
          left: 0,
          top: 0,
          radius: 0,
          fill: fillColor,
          stroke: playerColor,
          strokeWidth: 2,
          selectable: false,
          originX: 'center',
          originY: 'center',
          objectCaching: false,
        });
      } else if (type === 'Cone') {
        ConeTypeInit();
        canvas.measure.coneAngle = 53; // default D&D 5e cone (width = length)
        canvas.measure.measureArrow = arrowObject ?? new fabric.Cone([0, 0, 0, 0], {
          strokeWidth: 2,
          stroke: playerColor,
          fill: fillColor,
          selectable: false,
          coneAngle: 53,
        });
      } else {
        canvas.measure.measureArrow = arrowObject ?? new fabric.LineArrow([0, 0, 0, 0], {
          strokeWidth: 2,
          stroke: playerColor,
          selectable: false,
        });
      }

      canvas.measure.measureObject = measureObject ?? new fabric.Textbox("0", {
        left: 0,
        top: 0,
        width: 200,
        height: 90,
        fontSize: 56,
        fill: playerColor,
        selectable: false,
        editable: false,
      });

      canvas.measure.additionalObject = additionalObject ?? undefined;

      // Fetch map and gameId in parallel — they don't depend on each other
      const [map, gameId] = await Promise.all([
        ClientMediator.sendCommandAsync("BattleMap", "GetSelectedMap", { contextId: this.contextId }),
        ClientMediator.sendCommandAsync("Game", "GetGameId", {}),
      ]);

      // Fetch both settings collections in parallel too
      const [measureSettings, gameMeasureSettings] = await Promise.all([
        ClientMediator.sendCommandAsync("Properties", "GetByNames", {
          parentId: map.id ?? map.Id,
          names: ["baseDistanceUnit", "useSquaredSystem", "baseDistancePerSquare"],
        }),
        ClientMediator.sendCommandAsync("Properties", "GetByNames", {
          parentId: gameId,
          names: ["baseDistanceUnit", "useSquaredSystem", "baseDistancePerSquare"],
        }),
      ]);

      // Single-pass: build a lookup map instead of 6 separate .find() calls
      const toMap = (arr) => Object.fromEntries((arr ?? []).map((s) => [s.name, s.value]));
      const ms = toMap(measureSettings);
      const gms = toMap(gameMeasureSettings);

      canvas.measure = {
        ...canvas.measure,
        units: ms.baseDistanceUnit ?? gms.baseDistanceUnit ?? "ft",
        realisticMeasure: UtilityHelper.ParseBool(ms.useSquaredSystem) ?? UtilityHelper.ParseBool(gms.useSquaredSystem) ?? false,
        distancePerSquare: ms.baseDistancePerSquare
          ? parseInt(ms.baseDistancePerSquare)
          : gms.baseDistancePerSquare
            ? parseInt(gms.baseDistancePerSquare)
            : 5,
      };

      this._addPopupAndOverlay(overlayContent, popupContent);

      canvas.getObjects().forEach((object) => {
        object.set({ beforeMeasureSelectable: object.selectable, selectable: false });
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
    const canvas = this._canvas;
    this.SetSimpleCreateMode({ enabled: false });
    this.SetFreeDrawMode({ enabled: false });
    this.UnsetTokenSelectMode({});
    // Pass the current editLayer so SetLayerEditMode's layer===undefined guard doesn't short-circuit
    this.SetLayerEditMode({ editMode: false, layer: canvas.editLayer ?? canvas.selectedLayer });
    this.SetMeasureMode({ enabled: false });
  }

  CleanPreviews() {
    const currentPlayer = ClientMediator.sendCommand("Game", "GetCurrentPlayer");
    const canvas = this._canvas;
    const filteredObjects = canvas.getObjects().filter(
      (object) => object.previewId && object.playerId === currentPlayer.id
    );

    filteredObjects.forEach((object) => {
      canvas.remove(object);
    });
    
    if (canvas.measure?.visibleToOthers === true) {
      WebSocketManagerInstance.Send({
        command: "preview_end",
        battleMapId: this.contextId,
        data: [filteredObjects.map((object) => ({ previewId: object.previewId, playerId: object.playerId }))],
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
