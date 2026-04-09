/* eslint-disable react-hooks/exhaustive-deps, no-unused-vars */
import * as React from "react";
import { fabric } from "fabric";
import CommandFactory from "./Factories/CommandFactory";
import { useFabricJSEditor } from "fabricjs-react";
import { FabricJSCanvas } from "fabricjs-react";
import * as Dockable from "@hlorenzi/react-dockable";
import { ActiveWebHelper as WebHelper } from "../../helpers/transport";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../helpers/transport";
import ClientMediator from "../../ClientMediator";
import { Flex } from "@chakra-ui/react";
import BattleMapContextMenu from "../game/ToolBar/ContextMenus/BattleMapContextMenu";
import { PopupBMOverlay } from "./Overlays/PopupBMOverlay";
import { InfoBMOverlay } from "./Overlays/InfoBMOverlay";
import "../../stylesheets/battlemap.css";
import { LoadingScreen } from "../uiComponents/LoadingScreen";
import { PerformanceMonitor } from "../../helpers/PerformanceMonitor";
import createLoadCanvas from './Handlers/LoadCanvas';
import BasePanel from "../uiComponents/base/BasePanel";
import { _entityPermissionSetter } from "../../contexts/PermissionsContext";
import { ENTITY_TYPES, PERM } from "./Helpers/permissionBits";

const BattlemapComponent = ({ withID, keyboardEventsManagerRef }) => {
  // Performance monitor: track renders for this component
  PerformanceMonitor.trackRender('Battlemap', { withID });

  const [uuid] = React.useState(withID);
  const [error, setError] = React.useState(false);
  const { editor, onReady } = useFabricJSEditor();

  const [battleMapModel, setBattleMapModel] = React.useState(undefined);
  const [, setLoading] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  // map reference for loading elements into the battlemap
  const mapRef = React.useRef(undefined);
  const battleMapContainerRef = React.useRef(null);

  // battlemap object is used for contexts, in short you can have many contexts and open separate panel with it. albo keyboard have to process it
  const battleMapObjectRef = React.useRef({});

  //this map is for loading data
  let map = mapRef.current;
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  const ctx = Dockable.useContentContext();

  // Make canvas existence a simple boolean so dependency array is stable
  const hasCanvas = !!(editor && editor.canvas);

  // Reload handler so services can request a top-level reload that matches component behavior
  const ReloadBattleMap = React.useCallback(async () => {
    setLoading(true);
    try {
      const battleMapResponse = await WebHelper.getAsync(`battlemap/GetBattlemap?id=${uuid}`);
      setBattleMapModel(battleMapResponse);
    } catch (err) {
      console.error('ReloadBattleMap failed', err);
    } finally {
      setLoading(false);
    }
  }, [uuid]);

  // Hoisted delegate to the extracted LoadCanvas handler. Using a function declaration
  // ensures callers defined earlier (ChangeMap, effects) can call it safely.
  async function LoadCanvas() {
    const loadFn = createLoadCanvas({
      editor,
      mapRef,
      battleMapModel,
      forceUpdate,
      keyboardEventsManagerRef,
      battleMapObjectRef,
      battleMapContainerRef,
      ctx,
      uuid,
      setLoading,
      reloadBattleMap: ReloadBattleMap,
      changeMap: ChangeMap,
    });
    await loadFn();
  }

  // Load canvas when the editor canvas becomes available or model changes.
  // This effect must run before any early returns in the component so hooks order is stable.
  React.useEffect(() => {
    if (!editor || !editor.canvas) return;
    let mounted = true;
    const load = async () => {
      const loadFn = createLoadCanvas({
        editor,
        mapRef,
        battleMapModel,
        forceUpdate,
        keyboardEventsManagerRef,
        battleMapObjectRef,
        battleMapContainerRef,
        ctx,
        uuid,
        setLoading,
        reloadBattleMap: ReloadBattleMap,
        changeMap: ChangeMap,
      });
      await loadFn();
      if (mounted) {
        setLoaded(true);
        console.log("Canvas: Loaded");
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [battleMapModel, hasCanvas]);

  //change map
  const ChangeMap = async (mapId) => {
    const respMap = await WebHelper.getAsync(`map/get?mapId=${mapId}`);
    if (!respMap) {
      console.error(`ChangeMap: map/get returned nothing for mapId="${mapId}"`);
      return `Map not found: ${mapId}`;
    }
    mapRef.current = respMap;

    // Load map entity permissions for the current player
    try {
      const isGM = ClientMediator.sendCommand("Game", "GetIsGM");
      if (isGM) {
        _entityPermissionSetter.current?.(ENTITY_TYPES.MAP, mapId, PERM.ALL);
      } else {
        const currentPlayer = await ClientMediator.sendCommandWaitForRegisterAsync("Game", "GetCurrentPlayer", {}, true);
        if (currentPlayer) {
          const mapPerms = await WebHelper.getAsync(
            `security/permissions?entityId=${mapId}&entityType=${ENTITY_TYPES.MAP}`
          );
          const bits = mapPerms?.[currentPlayer.id] ?? PERM.NONE;
          _entityPermissionSetter.current?.(ENTITY_TYPES.MAP, mapId, bits);
        }
      }
    } catch (e) {
      console.warn('ChangeMap: failed to load map entity permissions', e);
    }
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

    //todo find name of battlemap
    if (editor && editor.canvas) {
      await LoadCanvas();
    }
  };

  // Legacy one-shot initialization effect moved below after ChangeMap definition
  React.useEffect(() => {
    WebHelper.get(
      `battlemap/getbattlemap?id=${withID}`,
      async (resp) => {
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
  if (editor !== undefined && editor.canvas) {
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
                obj.resourceId = dragObj.id;
                obj.resourceKey = dragObj.key;
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
              contextId: battleMapObjectRef.current.id,
              cardId: dragObj.id,
              position: coords,
            });
          }

          if (dragObj.entityType === "MapModel") {
            let command = CommandFactory.CreateChangeMapCommand(
              dragObj.id,
              battleMapObjectRef.current.id
            );
            WebSocketManagerInstance.Send(command);
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
                  obj.resourceId = result.id;
                  obj.resourceKey = result.key;
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
  };  ctx?.setTitle("BM - " + battleMapModel.name);

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
      {!loaded && <LoadingScreen />}
      <BattleMapContextMenu
        loaded={loaded}
        battleMapId={uuid}
        canvas={editor?.canvas}
      >
        <FabricJSCanvas onReady={onReady} />{" "}
      </BattleMapContextMenu>
      <PopupBMOverlay key={uuid + "popup"} battleMapId={uuid} />
      <InfoBMOverlay battleMapId={uuid} />    </Flex>
  );
};

export const Battlemap = (props) => {
  return <BasePanel><BattlemapComponent {...props} /></BasePanel>;
};

export default Battlemap;
