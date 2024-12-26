import * as React from "react";
import { fabric } from "fabric";
import CommandFactory from "./Factories/CommandFactory";
import GridFactoryInstance from "./Factories/GridFactory";
import { useFabricJSEditor } from "fabricjs-react";
import { FabricJSCanvas } from "fabricjs-react";
import * as Dockable from "@hlorenzi/react-dockable";
import WebHelper from "../../helpers/WebHelper";
import WebSocketManagerInstance from "../game/WebSocketManager";
import InteractionsManger from "./Managers/BMQueryService";
import BattleMapBMService from "./Managers/BMService";
import { Flex } from "@chakra-ui/react";
import LoadBMSubscriptions from "./Loaders/LoadBMSubscriptions";
import DTOConverter from "./DTOConverter";
import BattleMapContextMenu from "../game/ToolBar/ContextMenus/BattleMapContextMenu";
import ClientMediator from "../../ClientMediator";
import TokenManager from "./Managers/TokenManager";
import { PopupBMOverlay } from "./Overlays/PopupBMOverlay";
import { InfoBMOverlay } from "./Overlays/InfoBMOverlay";
import "../../stylesheets/battlemap.css";

export const Battlemap = ({ withID, keyboardEventsManagerRef }) => {
  const [uuid, _setUUID] = React.useState(withID);
  const [error, setError] = React.useState(false);
  const { selectedObjects, editor, onReady } = useFabricJSEditor();

  const [editLayerMode, setEditLayerMode] = React.useState(false);
  const [battleMapModel, setBattleMapModel] = React.useState(undefined);
  const [loading, setLoading] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  // map reference for loading elements into the battlemap
  const mapRef = React.useRef(undefined);
  const battleMapContainerRef = React.useRef(null);

  const contextMenuRef = React.useRef(null);

  // battlemap object is used for contexts, in short you can have many contexts and open separate panel with it. albo keyboard have to process it
  const battleMapObjectRef = React.useRef({});

  //this map is for loading data
  let map = mapRef.current;

  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  const ctx = Dockable.useContentContext();

  React.useEffect(() => {
    if (!editor || !editor.canvas) return;
    const loadCanvas = async () => {
      await LoadCanvas();
      setLoaded(true);
      console.log("Canvas: Loaded");
    };

    loadCanvas();
  }, [battleMapModel, editor && editor.canvas]);

  //On destruction of battlemap(clicking 'x' in panel). set inform app that battlemap no longer exists(can be written better)
  React.useEffect(() => {
    WebHelper.get(
      `battlemap/getbattlemap?id=${withID}`,
      async (resp) => {
        ctx.setTitle(resp.name);
        await ChangeMap(resp.mapId);
        setBattleMapModel(resp);
      },
      (error) => {
        setError(true);
      }
    );
    return () => {
      WebSocketManagerInstance.Unsubscribe("BattleMap" + uuid);
      ClientMediator.unregister("BMQueryService" + uuid);
      ClientMediator.unregister("BMService" + uuid);
      ClientMediator.sendCommand("Game", "DeleteBattleMapContext", {
        id: uuid,
      });
    };
  }, []);

  if (error) {
    ctx.setTitle("Error - No battlemap found");
    return <>Error</>;
  }

  //Reload battle map means load this again
  const ReloadBattleMap = () => {
    ChangeMap(mapRef.current.id);
  };

  //change map
  const ChangeMap = async (mapId) => {
    const respMap = await WebHelper.getAsync(`map/get?mapId=${mapId}`);
    mapRef.current = respMap;
    const allProps = [];
    allProps.push(...mapRef.current.properties);
    await Promise.all(
      mapRef.current.elements.map(async (element) => {
        allProps.push(...element.properties);
        return true;
      })
    );

    await ClientMediator.sendCommandAsync("Properties", "AddToCache", {
      properties: allProps,
    });

    setLoading(true);
  };

  const DrawGrid = () => {
    let objects = editor.canvas
      .getObjects("group")
      .filter((x) => x.name === ".grid");
    if (objects.length > 0) {
      objects.forEach((element) => {
        editor.canvas.remove(element);
      });
    }

    if (map.gridVisible) {
      var grid = GridFactoryInstance.DrawGrid(map.gridSize, [
        map.width,
        map.height,
      ]);

      let found = editor.canvas._objects.findIndex((x) => x.layer >= 0);

      editor.canvas.insertAt(grid, found);
    }
  };

  if (map !== undefined && map !== null) {
    if (ctx.layoutContent.panel.floating) {
      ctx.setPreferredSize(map.width, map.height);
    }
  }

  //Put in loadable
  if (!battleMapModel) {
    return <>{"Loading..."}</>;
  }

  if (
    battleMapObjectRef !== undefined &&
    battleMapObjectRef.current.Panel !== ctx.layoutContent.panel
  ) {
    battleMapObjectRef.current.Panel = ctx.layoutContent.panel;
  }

  if (editor !== undefined) {
    editor.canvas.setDimensions({
      width: ctx.layoutContent.layoutPanel.rect.w,
      height: ctx.layoutContent.layoutPanel.rect.h,
    });
  }

  //Handle file drop on battlemap. I should move it to separate component. This will be also required for resources panel(when i will create one)
  const HandleDrop = (ev) => {
    if (ev.dataTransfer.items) {
      const coords = editor.canvas.getPointer(ev);
      [...ev.dataTransfer.items].forEach((item, i) => {
        if (item.kind === "string") {
          let dragObj = JSON.parse(sessionStorage.getItem("draggable"));
          if (dragObj.entityType === "ResourceModel") {
            console.log(dragObj);
            fabric.Image.fromURL(
              WebHelper.getResourceString(dragObj.id),
              (img) => {
                const obj = img;
                if (!obj.width) {
                  return;
                }
                obj.left = coords.x + 10 * i;
                obj.top = coords.y + 10 * i;
                var cmd = CommandFactory.CreateAddCommand({
                  object: JSON.stringify(obj),
                  properties: [],
                  mapId: map.id,
                  layer: editor.canvas.selectedLayer,
                });
                WebSocketManagerInstance.Send(cmd);
              }
            );
          }

          if (dragObj.entityType === "CardModel") {
            ClientMediator.sendCommand("BattleMap_token", "CreateToken", {
              contextId: battleMapObjectRef.current.Id,
              cardId: dragObj.id,
              position: coords,
            });
          }
        }

        if (item.kind === "file") {
          WebHelper.postMaterial(
            item.getAsFile(),
            (result) => {
              fabric.Image.fromURL(
                WebHelper.getResourceString(result.id),
                (img) => {
                  const obj = img;
                  obj.left = coords.x + 10 * i;
                  obj.top = coords.y + 10 * i;
                  var cmd = CommandFactory.CreateAddCommand({
                    object: JSON.stringify(obj),
                    properties: [],
                    mapId: map.id,
                    layer: editor.canvas.selectedLayer,
                  });
                  WebSocketManagerInstance.Send(cmd);
                }
              );
            },
            (error) => {
              console.error(error);
            }
          );
        }
      });
    }
  };

  return (
    <Flex
      ref={battleMapContainerRef}
      className="nm_battleMap"
      tabIndex={-1}
      onDrop={(e) => {
        e.preventDefault();
        HandleDrop(e);
      }}
      grow={1}
      onContextMenu={(e) => {
        e.preventDefault();
      }}
    >
      <FabricJSCanvas onReady={onReady} />
      <PopupBMOverlay battleMapId={uuid} />
      <InfoBMOverlay battleMapId={uuid} />
      <div ref={contextMenuRef} className="nm_bm_contextMenu">
        <BattleMapContextMenu
          contextMenuReference={contextMenuRef}
          loaded={loaded}
          battleMapId={uuid}
          canvas={editor?.canvas}
        />
      </div>
    </Flex>
  );

  async function LoadCanvas() {
    const BattleMapServices = {
      BMQueryService: new InteractionsManger(),
      BMService: new BattleMapBMService(),
    };

    BattleMapServices.BMService._BMQueryService =
      BattleMapServices.BMQueryService;

    editor.canvas.clear();
    editor.canvas.fireRightClick = true;
    editor.canvas.fireMiddleClick = true;
    editor.canvas.align = "left";
    editor.canvas.selectedLayer = 100;

    //Assing battlemap instance when necessary
    BattleMapServices.BMQueryService._canvas = editor.canvas;
    BattleMapServices.BMQueryService._battleMapModel = battleMapModel;
    BattleMapServices.BMQueryService.Load();
    BattleMapServices.BMService._canvas = editor.canvas;
    //BattleMapServices.BMService._argumentsRef = argumentsRef;
    BattleMapServices.BMService._refreshCommand = forceUpdate;
    BattleMapServices.BMService._reloadCommand = ReloadBattleMap;
    BattleMapServices.BMService._changeMapCommand = ChangeMap;
    BattleMapServices.BMService._setEditModeCommand = setEditLayerMode;
    BattleMapServices.BMService._contextMenuRef = contextMenuRef;
    BattleMapServices.BMService._battleMapModel = battleMapModel;
    BattleMapServices.BMService.Load();

    BattleMapServices.TokenManager = new TokenManager();
    BattleMapServices.TokenManager._canvas = editor.canvas;
    BattleMapServices.TokenManager._battleMapModel = battleMapModel;
    //BattleMapServices.TokenManager._argumentsRef = argumentsRef;
    BattleMapServices.TokenManager._refreshCommand = forceUpdate;
    BattleMapServices.TokenManager.Load(() => editor.canvas);

    //Assing Selected map instance when necessary
    BattleMapServices.BMQueryService._map = map;

    ClientMediator.register(BattleMapServices.BMQueryService);
    ClientMediator.register(BattleMapServices.BMService);
    ClientMediator.register(BattleMapServices.TokenManager);

    let bmObj = {
      Panel: ctx.layoutContent.panel,
      PanelContentID: ctx.layoutContent.content.contentId,
      Id: uuid,
    };

    battleMapObjectRef.current = bmObj;
    ClientMediator.sendCommand("Game", "AddBattleMapContext", {
      battleMapContext: bmObj,
    });

    const references = {
      mapRef,
      keyboardEventsManagerRef,
      battleMapObjectRef,
      //argumentsRef,
      battleMapContainerRef,
      contextMenuRef,
    };

    LoadBMSubscriptions(editor.canvas, references);

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
        });
      };
    })(fabric.Object.prototype.toObject);

    //Load elements and register them in ElementsStorage
    if (map.elements.length > 0) {
      let canvasObjects = [];
      map.elements.forEach((dto) => {
        if (dto.id == undefined || dto.id == null) {
          console.error("No Id for element! data is corrupted");
          return;
        }

        const object = DTOConverter.ConvertFromDTO(dto);
        object.properties = object.properties || {};

        object.selectable =
          object.selectablePermission &&
          dto.layer == editor.canvas.selectedLayer;
        canvasObjects.push(object);
      });

      try {
        editor.canvas.loadFromJSON({ objects: canvasObjects }, async () => {
          DrawGrid();
          editor.canvas._objects.sort((a, b) =>
            a.layer > b.layer || a.insideLayerIndex > b.insideLayerIndex
              ? 1
              : -1
          );

          const objects = editor.canvas.getObjects();

          // Get all card ids from objects
          const cardIds = objects
            .filter((obj) => obj.tokenData?.cardId)
            .map((obj) => obj.tokenData?.cardId);

          // distinct card ids
          const distinctCardIds = [...new Set(cardIds)];
          //load all to cache to not fire so many queries

          await Promise.all(
            distinctCardIds.map(async (cardId) => {
              await ClientMediator.sendCommandAsync(
                "Properties",
                "LoadToCache",
                { parentId: cardId }
              );
              return true;
            })
          );

          await Promise.all(
            objects.map(async (obj) => {
              if (!obj.id) return false;

              //originally there was Mediator request. i replaced with simpler check that should do a work.
              let isToken = obj.tokenData !== undefined ? true : false;
              if (isToken) {
                BattleMapServices.TokenManager.CanvasObjectLoadToken({
                  id: obj.id,
                });
              }

              return true;
            })
          );

          //set default settings
          editor.canvas.alignMode = "corners";
          editor.canvas.getPointerWithAlign = function (e) {
            let pointer = editor.canvas.getPointer(e, false);
            let align = editor.canvas.alignMode;
            //if align mode different than none, align to grid
            if (align !== "none") {
              let gridSize = map.gridSize;
              let x,
                y = 0;
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
        });
      } catch (error) {
        console.error(error);
      }
    } else {
    }

    DrawGrid();
    setLoading(false);
  }
};

export default Battlemap;
