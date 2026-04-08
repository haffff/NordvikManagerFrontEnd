import InteractionsManger from "../Managers/BMQueryService";
import BattleMapBMService from "../Managers/BMService";
import TokenManager from "../Managers/TokenManager";
import ClientMediator from "../../../ClientMediator";
import LoadBMSubscriptions from "../Loaders/LoadBMSubscriptions";
import DTOConverter from "../DTOConverter";
import GridHelper from '../Helpers/GridHelper';
import { fabric } from "fabric";

// Factory that creates a LoadCanvas async function bound to provided dependencies
export default function createLoadCanvas(deps) {
  const {
    editor,
    mapRef,
    battleMapModel,
    forceUpdate,
    keyboardEventsManagerRef,
    battleMapObjectRef,
    battleMapContainerRef,
    ctx,
    uuid,
    // optional:
    setLoading,
    // optional callbacks provided by Battlemap component so services can trigger full reload/change
    reloadBattleMap,
    changeMap,
  } = deps;

  return async function LoadCanvas() {
    const map = mapRef.current;

    const BattleMapServices = {
      BMQueryService: new InteractionsManger(),
      BMService: new BattleMapBMService(),
    };

    // Wire optional commands so BMService.ReloadBattleMapComponent will invoke the component-provided reload
    if (typeof reloadBattleMap === 'function') {
      BattleMapServices.BMService._reloadCommand = reloadBattleMap;
    }
    if (typeof changeMap === 'function') {
      BattleMapServices.BMService._changeMapCommand = changeMap;
    }

    BattleMapServices.BMService._BMQueryService =
      BattleMapServices.BMQueryService;

    // for now save editGridMode
    let oldEditGridMode = editor.canvas.editGridMode;
    editor.canvas.clear();
    editor.canvas.editGridMode = oldEditGridMode;
    editor.canvas.fireRightClick = true;
    editor.canvas.fireMiddleClick = true;
    editor.canvas.align = "left";
    editor.canvas.selectedLayer = 100;
    editor.canvas.defaultCursor = "default";
    editor.canvas.hoverCursor = "default";

    // Assign battlemap instance when necessary
    BattleMapServices.BMQueryService._canvas = editor.canvas;
    BattleMapServices.BMQueryService._battleMapModel = battleMapModel;
    BattleMapServices.BMQueryService.Load();
    BattleMapServices.BMService._canvas = editor.canvas;
    BattleMapServices.BMService._refreshCommand = forceUpdate;
    BattleMapServices.BMService._battleMapModel = battleMapModel;
    BattleMapServices.BMService.Load();

    BattleMapServices.TokenManager = new TokenManager();
    BattleMapServices.TokenManager._canvas = editor.canvas;
    BattleMapServices.TokenManager._battleMapModel = battleMapModel;
    BattleMapServices.TokenManager._refreshCommand = forceUpdate;
    BattleMapServices.TokenManager.Load(() => editor.canvas);

    // Assign Selected map instance when necessary
    BattleMapServices.BMQueryService._map = map;

    ClientMediator.register(BattleMapServices.BMQueryService);
    ClientMediator.register(BattleMapServices.BMService);
    ClientMediator.register(BattleMapServices.TokenManager);

    let bmObj = {
      Panel: ctx.layoutContent.panel,
      PanelContentID: ctx.layoutContent.content.contentId,
      id: uuid,
    };

    battleMapObjectRef.current = bmObj;
    ClientMediator.sendCommand("Game", "AddBattleMapContext", {
      battleMapContext: bmObj,
    });

    const references = {
      mapRef,
      keyboardEventsManagerRef,
      battleMapObjectRef,
      battleMapContainerRef,
    };

    LoadBMSubscriptions(editor.canvas, references);

    // extend toObject for serialization
    fabric.Object.prototype.toObject = (function (toObject) {
      return function () {
        return fabric.util.object.extend(toObject.call(this), {
          id: this.id,
          name: this.name === undefined ? this.type : this.name,
          text: this.text,
          radius: this.radius,
          tokenUiElements: this.tokenUiElements,
          tokenData: this.tokenData,
          isTokenUi: this.isTokenUi,
          parentId: this.parentId,
          originalLeft: this.originalLeft,
          originalTop: this.originalTop,
          fontSize: this.fontSize,
          previewId: this.previewId,
          playerId: this.playerId,
          resourceId: this.resourceId,
          resourceKey: this.resourceKey,
        });
      };
    })(fabric.Object.prototype.toObject);

    // sort layers helper
    editor.canvas.sortLayers = function () {
      this._objects.sort((a, b) =>
        a.layer > b.layer || a.insideLayerIndex > b.insideLayerIndex ? 1 : -1
      );
    };

    // Load elements and register them in ElementsStorage
    if (map.elements && map.elements.length > 0) {
      let canvasObjects = [];
      for (const dto of map.elements) {
        if (dto.id === undefined || dto.id === null) {
          console.error("No Id for element! data is corrupted");
          continue;
        }

        const object = DTOConverter.ConvertFromDTO(dto);
        object.properties = object.properties || {};
        object.selectable =
          object.selectablePermission && dto.layer === editor.canvas.selectedLayer;
        canvasObjects.push(object);
      }

      try {
        editor.canvas.loadFromJSON({ objects: canvasObjects }, async () => {
          // Draw grid before sorting so grid insertion index is computed correctly
          try {
            GridHelper(editor.canvas, map);
          } catch (e) {
            console.warn('LoadCanvas: failed to draw grid', e);
          }
          editor.canvas.sortLayers();
          const objects = editor.canvas.getObjects();

          // Get distinct card ids
          const cardIds = objects
            .filter((obj) => obj.tokenData?.cardId)
            .map((obj) => obj.tokenData?.cardId);
          const distinctCardIds = [...new Set(cardIds)];

          // load properties to cache
          await Promise.all(
            distinctCardIds.map(async (cardId) => {
              await ClientMediator.sendCommandAsync("Properties", "LoadToCache", { parentId: cardId });
              return true;
            })
          );

          await Promise.all(
            objects.map(async (obj) => {
              if (!obj.id) return false;
              const isToken = obj.tokenData !== undefined;
              if (isToken) {
                BattleMapServices.TokenManager.CanvasObjectLoadToken({ id: obj.id });
              }
              editor.canvas.requestRenderAll();
              return true;
            })
          );
        });
      } catch (error) {
        console.error(error);
      }
    }
    else
    {
      //just draw grid if no elements, to avoid multiple grid redraws during element loading
      try {
        GridHelper(editor.canvas, map);
      } catch (e) {
        console.warn('LoadCanvas: failed to draw grid', e);
      }
    }

    // set default settings
    editor.canvas.alignMode = "corners";
    editor.canvas.getPointerWithAlign = function (e) {
      let pointer = editor.canvas.getPointer(e, false);
      let align = editor.canvas.alignMode;
      if (align !== "none") {
        let gridSize = map.gridSize;
        let x, y = 0;
        x = Math.round(pointer.x / gridSize) * gridSize;
        y = Math.round(pointer.y / gridSize) * gridSize;
        if (align === "center") {
          x += gridSize / 2;
          y += gridSize / 2;
        }
        pointer = { x: x, y: y };
      }
      return pointer;
    };

    if (typeof setLoading === 'function') setLoading(false);
  };
}
