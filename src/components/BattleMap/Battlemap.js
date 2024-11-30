import * as React from "react";
import { fabric } from "fabric";
import CommandFactory from "./Factories/CommandFactory";
import GridFactoryInstance from "./Factories/GridFactory";
import { useFabricJSEditor } from "fabricjs-react";
import { FabricJSCanvas } from "fabricjs-react";
import {
  BehaviorDictionaryClient,
  BehaviorDictionaryServer,
} from "./Behaviors/BehaviorDictionary";
import * as Dockable from "@hlorenzi/react-dockable";
import WebHelper from "../../helpers/WebHelper";
import WebSocketManagerInstance from "../game/WebSocketManager";
import InteractionsManger from "./Managers/BMQueryService";
import BattleMapBMService from "./Managers/BMService";
import { Flex } from "@chakra-ui/react";
import LoadBMSubscriptions from "./Loaders/LoadBMSubscriptions";
import BattleMapOperations from "./BattlemapModes";
import DTOConverter from "./DTOConverter";
import BattleMapContextMenu from "../game/ToolBar/ContextMenus/BattleMapContextMenu";
import UtilityHelper from "../../helpers/UtilityHelper";
import ClientMediator from "../../ClientMediator";
import TokenManager from "./Managers/TokenManager";

export const Battlemap = ({ withID, keyboardEventsManagerRef }) => {
  const [uuid, _setUUID] = React.useState(withID);
  const [error, setError] = React.useState(false);
  const { selectedObjects, editor, onReady } = useFabricJSEditor();

  const [editLayerMode, setEditLayerMode] = React.useState(false);
  const [battleMapModel, setBattleMapModel] = React.useState(undefined);
  const [loading, setLoading] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  const [selectedLayer, setSelectedLayer] = React.useState(100);
  // map reference for loading elements into the battlemap
  const mapRef = React.useRef(undefined);
  const layerRef = React.useRef(selectedLayer);
  const battleMapContainerRef = React.useRef(null);

  const popupRef = React.useRef(null);
  const popupVisible = React.useRef(null);
  const operationRef = React.useRef(BattleMapOperations.SELECT);
  const argumentsRef = React.useRef({});
  const contextMenuRef = React.useRef(null);
  const contextMenuVisibleRef = React.useRef(null);

  const [popupContent, setPopupContent] = React.useState(undefined);

  layerRef.current = selectedLayer;
  const getSelectedLayer = () => layerRef;

  // battlemap object is used for contexts, in short you can have many contexts and open separate panel with it. albo keyboard have to process it
  const battleMapObjectRef = React.useRef({});

  //this map is for loading data
  let map = mapRef.current;

  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  const ctx = Dockable.useContentContext();

  //On destruction of battlemap(clicking 'x' in panel). set inform app that battlemap no longer exists(can be written better)
  React.useEffect(() => {
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
  const ChangeMap = (mapId) => {
    WebHelper.get(`map/get?mapId=${mapId}`, (respMap) => {
      mapRef.current = respMap;
      setLoading(true);
    });
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
    WebHelper.get(
      `battlemap/getbattlemap?id=${withID}`,
      (resp) => {
        ctx.setTitle(resp.name);
        ChangeMap(resp.mapId);
        setBattleMapModel(resp);
      },
      (error) => {
        setError(true);
      }
    );
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

  //Check if canvas is ready
  if (editor !== undefined && loading) {
    LoadCanvas();
    setLoaded(true);
    console.log("Canvas: Loaded");
  }

  if (loading) {
    return <>Loading...</>;
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
              `${WebHelper.ApiAddress}/Materials/Resource?id=${dragObj.id}`,
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
                  layer: selectedLayer,
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
            `${mapRef.current.name}/images`,
            (result) => {
              fabric.Image.fromURL(
                `${WebHelper.ImageAddress}${result.id}`,
                (img) => {
                  const obj = img;
                  obj.left = coords.x + 10 * i;
                  obj.top = coords.y + 10 * i;
                  var cmd = CommandFactory.CreateAddCommand({
                    object: JSON.stringify(obj),
                    properties: [],
                    mapId: map.id,
                    layer: selectedLayer,
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
      flexGrow={1}
      direction={"row"}
      height="100%"
      width="100%"
      className="content"
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
      <div
        ref={popupRef}
        style={{
          display: "none",
          position: "absolute",
          padding: "5px",
          margin: "10px",
          backgroundColor: "#353535",
          border: "1px solid #ddd",
        }}
      >
        {popupContent}
      </div>
      <div
        ref={contextMenuRef}
        style={{ display: "none", position: "absolute" }}
      >
        <BattleMapContextMenu
          contextMenuReference={contextMenuRef}
          loaded={loaded}
          battleMapId={uuid}
          canvas={editor?.canvas}
        />
      </div>
    </Flex>
  );

  function LoadCanvas() {
    const BattleMapServices = {
      BMQueryService: new InteractionsManger(),
      BMService: new BattleMapBMService(),
    };

    BattleMapServices.BMService._BMQueryService =
      BattleMapServices.BMQueryService;

    editor.canvas.clear();
    editor.canvas.fireRightClick = true;
    editor.canvas.fireMiddleClick = true;

    //Assing battlemap instance when necessary
    BattleMapServices.BMQueryService._canvas = editor.canvas;
    BattleMapServices.BMQueryService._battleMapModel = battleMapModel;
    BattleMapServices.BMQueryService._getSelectedLayer = getSelectedLayer;
    BattleMapServices.BMQueryService._popupRef = popupRef;
    BattleMapServices.BMQueryService._operationModeRef = operationRef;
    BattleMapServices.BMQueryService.Load();
    BattleMapServices.BMService._canvas = editor.canvas;
    BattleMapServices.BMService._argumentsRef = argumentsRef;
    BattleMapServices.BMService._refreshCommand = forceUpdate;
    BattleMapServices.BMService._reloadCommand = ReloadBattleMap;
    BattleMapServices.BMService._changeMapCommand = ChangeMap;
    BattleMapServices.BMService._setSelectedLayerCommand = setSelectedLayer;
    BattleMapServices.BMService._setEditModeCommand = setEditLayerMode;
    BattleMapServices.BMService._setPopupContent = setPopupContent;
    BattleMapServices.BMService._popupVisible = popupVisible;
    BattleMapServices.BMService._operationModeRef = operationRef;
    BattleMapServices.BMService._battleMapModel = battleMapModel;
    BattleMapServices.BMService.Load();

    BattleMapServices.TokenManager = new TokenManager();
    BattleMapServices.TokenManager._canvas = editor.canvas;
    BattleMapServices.TokenManager._battleMapModel = battleMapModel;
    BattleMapServices.TokenManager._operationModeRef = operationRef;
    BattleMapServices.TokenManager._argumentsRef = argumentsRef;
    BattleMapServices.TokenManager._setPopupContent = setPopupContent;
    BattleMapServices.TokenManager._popupVisible = popupVisible;
    BattleMapServices.TokenManager._refreshCommand = forceUpdate;
    BattleMapServices.TokenManager.Load();

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
      operationRef,
      popupRef,
      mapRef,
      popupVisibleRef: popupVisible,
      keyboardEventsManagerRef,
      battleMapObjectRef,
      argumentsRef,
      battleMapContainerRef,
      contextMenuVisibleRef,
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
          showOnTokenControl: this.showOnTokenControl,

          isTokenUi: this.isTokenUi,
          parentId: this.parentId,
          originalLeft: this.originalLeft,
          originalTop: this.originalTop,
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
          object.selectablePermission && dto.layer == selectedLayer;
        canvasObjects.push(object);
      });

      try {
        editor.canvas.loadFromJSON({ objects: canvasObjects }, () => {
          DrawGrid();
          editor.canvas._objects.sort((a, b) =>
            a.layer > b.layer || a.insideLayerIndex > b.insideLayerIndex
              ? 1
              : -1
          );

          editor.canvas
            .getObjects()
            .filter((x) => {
              if (!x.properties) return false;
              return UtilityHelper.ParseBool(x.properties["isToken"]?.value);
            })
            .forEach((o) =>
              BattleMapServices.TokenManager.CanvasObjectLoadToken(
                {id: o.id}
              )
            );
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
