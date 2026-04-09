import * as React from "react";
import { DropDownMenu } from "../../../uiComponents/base/DDItems/DropDownMenu";
import { DropDownItem } from "../../../uiComponents/base/DDItems/DropDownItem";
import {
  FaArrowAltCircleDown,
  FaArrowAltCircleUp,
  FaChess,
  FaCheckCircle,
  FaCog,
  FaCopy,
  FaEye,
  FaLayerGroup,
  FaLock,
  FaMap,
  FaObjectUngroup,
  FaPaste,
  FaExchangeAlt,
  FaPlus,
  FaShieldAlt,
  FaTrash,
  FaWrench,
  FaRegCheckCircle,
} from "react-icons/fa";
import Loadable from "../../../uiComponents/base/Loadable";
import Subscribable from "../../../uiComponents/base/Subscribable";
import CollectionSyncer from "../../../uiComponents/base/CollectionSyncer";
import DTOConverter from "../../../BattleMap/DTOConverter";
import { ActiveTransportManager as WebSocketManagerInstance, ActiveWebHelper as WebHelper } from "../../../../helpers/transport";
import ClientMediator from "../../../../ClientMediator";
import { Heading } from "@chakra-ui/react";
import { MenuContent, MenuContextTrigger, MenuRoot } from "../../../ui/menu";
import { PERM, PERM_LEVEL, ENTITY_TYPES } from "../../../BattleMap/Helpers/permissionBits";
import CommandFactory from "../../../BattleMap/Factories/CommandFactory";
import UtilityHelper from "../../../../helpers/UtilityHelper";
import { usePermissions } from "../../../../contexts/PermissionsContext";
import { Tooltip } from "../../../ui/tooltip";

export const BattleMapContextMenu = ({ width, battleMapId, canvas, children }) => {
  const selectedObjects = canvas?.getActiveObjects() || [];
  const { hasEntityPermission, isGM } = usePermissions();

  // Resolve the current map id for entity-level permission checks
  const currentMap = ClientMediator.sendCommand("BattleMap", "GetSelectedMap", { contextId: battleMapId });
  const canEditMap = hasEntityPermission(ENTITY_TYPES.MAP, currentMap?.id, PERM.EDIT);

  // { [playerId]: bits } for the currently selected element
  const [elementPermissions, setElementPermissions] = React.useState({});
  const selectedId = selectedObjects.length === 1 ? selectedObjects[0]?.id : null;

  React.useEffect(() => {
    if (!selectedId) { setElementPermissions({}); return; }
    WebHelper.getAsync(`security/permissions?entityId=${selectedId}&entityType=ElementModel`)
      .then(perms => setElementPermissions(perms ?? {}))
      .catch(() => setElementPermissions({}));
  }, [selectedId]);

  const [maps, setMaps] = React.useState([]);
  React.useEffect(() => {
    WebHelper.getAsync('map/GetAllFlat').then(m => setMaps(m || [])).catch(() => {});
  }, []);

  const HandleDelete = () => {
    ClientMediator.sendCommand("BattleMap", "RemoveSelected", {
      contextId: battleMapId,
    });
  };

  const HandleSpawnProperties = () => {
    ClientMediator.sendCommand("Game", "CreateNewPanel", {
      type: "PropertiesPanel",
      battleMapId,
      props: {
        map: ClientMediator.sendCommand("BattleMap", "GetSelectedMap", {
          contextId: battleMapId,
        }),
      },
    });
  };

  const ShowBattleMap = (playerId) => {
    WebSocketManagerInstance.Send(
      CommandFactory.CreateShowBattleMapCommand(battleMapId, playerId)
    );
  };

  const HandleSpawnMapSettings = () => {
    ClientMediator.sendCommand("Game", "CreateNewPanel", {
      type: "MapSettingsPanel",
      battleMapId,
      props: {
        map: ClientMediator.sendCommand("BattleMap", "GetSelectedMap", {
          contextId: battleMapId,
        }),
      },
    });
  };

  const HandleSpawnTools = () => {
    ClientMediator.sendCommand("Game", "CreateNewPanel", {
      type: "ToolsPanel",
      battleMapId,
      props: {
        map: ClientMediator.sendCommand("BattleMap", "GetSelectedMap", {
          contextId: battleMapId,
        }),
      },
    });
  };

  const PasteElements = () => {
    return ClientMediator.sendCommand("BattleMap", "PasteElements", {
      contextId: battleMapId,
      coords: canvas.lastAbsolutePointer,
    });
  };

  const CopyElements = () => {
    return ClientMediator.sendCommand("BattleMap", "CopyElements", {
      contextId: battleMapId,
    });
  };

  const SwitchLayer = (layer) => {
    var dto = DTOConverter.ConvertToDTOMinified(selectedObjects[0], []);
    dto.layer = layer;
    dto.insideLayerIndex = 0;
    WebSocketManagerInstance.Send({
      command: "element_update",
      data: dto,
      action: "layer",
    });
  };

  const MoveUp = () => {
    if (!selectedObjects[0].insideLayerIndex) {
      selectedObjects[0].insideLayerIndex = 1;
    } else {
      selectedObjects[0].insideLayerIndex++;
    }

    WebSocketManagerInstance.Send({
      command: "element_update",
      data: DTOConverter.ConvertToDTO(selectedObjects[0]),
      action: "layer",
    });
  };

  const MoveDown = () => {
    if (!selectedObjects[0].insideLayerIndex) {
      selectedObjects[0].insideLayerIndex = -1;
    } else {
      selectedObjects[0].insideLayerIndex--;
    }

    WebSocketManagerInstance.Send({
      command: "element_update",
      data: DTOConverter.ConvertToDTO(selectedObjects[0]),
      action: "layer",
    });
  };

  const SetPermission = (playerId, bits) => {
    const entityId = selectedObjects[0]?.id;
    if (!entityId) return;
    const permissions = { [playerId]: bits };
    const cmd = CommandFactory.CreateUpdatePermissionsCommand(entityId, 'ElementModel', permissions);
    WebSocketManagerInstance.Send(cmd);
    // Optimistic update so checkmark reflects the change immediately.
    setElementPermissions(prev => ({ ...prev, [playerId]: bits }));
  };

  const GetPlayersForPermissions = () => {
    return ClientMediator.sendCommand('Game', 'GetPlayers') || [];
  };

        const check = (playerId, level) =>
        {

            let userPermission = elementPermissions[playerId] === level
                ? <FaCheckCircle style={{ color: 'var(--chakra-colors-green-400)' }} />
                : null;
            let defaultPermission = elementPermissions[playerId] === undefined && elementPermissions[UtilityHelper.EmptyGuid] === level
                ? (<Tooltip content={"Everyone has this permission level"}><FaRegCheckCircle style={{ color: 'var(--chakra-colors-green-400)' }} /></Tooltip>)
                : null;

            return (
                <>
                    {userPermission}
                    {defaultPermission}
                </>
            );
        }

  // Returns a shield icon when the player has above-Edit (admin-level) permissions.
  const adminIcon = (playerId) => {
    const bits = elementPermissions[playerId];
    return bits > PERM_LEVEL.EDIT
      ? <FaShieldAlt style={{ color: 'orange' }} title="Admin-level permission" />
      : undefined;
  };

  width = width || 150;

  return (
    <MenuRoot onOpenChange={(d) => {
        if(canvas.contextMenuLock){
            d.open = false;
        }
    }}>
      <MenuContextTrigger >{children}</MenuContextTrigger>
      <MenuContent>
        <Subscribable commandPrefix="permission_update" onMessage={(msg) => {
          if (msg.data?.entityType !== 'ElementModel' || msg.data?.id !== selectedId) return;
          setElementPermissions(msg.data.permissions ?? {});
        }} />
        <CollectionSyncer collection={maps} setCollection={setMaps} commandPrefix="map" />
        {selectedObjects && selectedObjects.length === 1 ? (
          <>
            <Heading
              size={"xs"}
              style={{
                textAlign: "center",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {selectedObjects[0].name}
            </Heading>
            <DropDownItem
              width={width}
              name={"Delete"}
              icon={FaTrash}
              onClick={HandleDelete}
            />
            <DropDownItem
              width={width}
              name={"Copy"}
              icon={FaCopy}
              onClick={CopyElements}
            />
            <DropDownItem
              width={width}
              name={"Paste"}
              icon={FaPaste}
              onClick={PasteElements}
            />
            <DropDownMenu submenu={true} width={width} name={"More Actions"}>
              <DropDownItem
                width={width}
                name={"Ungroup"}
                onClick={() => SwitchLayer(-100)}
                icon={FaObjectUngroup}
              />
              <DropDownItem
                width={width}
                name={"Move Up"}
                onClick={() => MoveUp()}
                icon={FaArrowAltCircleUp}
              />
              <DropDownItem
                width={width}
                name={"Move Down"}
                onClick={() => MoveDown()}
                icon={FaArrowAltCircleDown}
              />
            </DropDownMenu>
            <DropDownMenu
              submenu={true}
              width={width}
              name={"Move to layer"}
              icon={FaLayerGroup}
            >
              <DropDownItem
                width={width}
                name={"Token"}
                onClick={() => SwitchLayer(100)}
                icon={FaChess}
              />
              <DropDownItem
                width={width}
                name={"Background"}
                onClick={() => SwitchLayer(-100)}
                icon={FaMap}
              />
            </DropDownMenu>
            <DropDownItem
              width={width}
              name={"Properties"}
              onClick={HandleSpawnProperties}
              icon={FaWrench}
            />
            <DropDownMenu
              submenu={true}
              width={width}
              name={"Permissions"}
              icon={<FaLock />}
              gmOnly
            >
              {GetPlayersForPermissions().map((player) => (
                <DropDownMenu
                  key={player.id}
                  submenu={true}
                  width={width}
                  name={player.name || player.id}
                  icon={adminIcon(player.id)}
                >
                  <DropDownItem width={width} name={"See"}     icon={check(player.id, PERM_LEVEL.SEE)}     onClick={() => SetPermission(player.id, PERM_LEVEL.SEE)} />
                  <DropDownItem width={width} name={"Control"} icon={check(player.id, PERM_LEVEL.CONTROL)} onClick={() => SetPermission(player.id, PERM_LEVEL.CONTROL)} />
                  <DropDownItem width={width} name={"Edit"}    icon={check(player.id, PERM_LEVEL.EDIT)}    onClick={() => SetPermission(player.id, PERM_LEVEL.EDIT)} />
                  <DropDownItem width={width} name={"None"}    icon={check(player.id, PERM_LEVEL.NONE)}    onClick={() => SetPermission(player.id, PERM_LEVEL.NONE)} />
                </DropDownMenu>
              ))}
              <DropDownMenu
                submenu={true}
                width={width}
                name={"Everyone"}
                icon={adminIcon(UtilityHelper.EmptyGuid)}
              >
                <DropDownItem width={width} name={"See"}     icon={check(UtilityHelper.EmptyGuid, PERM_LEVEL.SEE)}     onClick={() => SetPermission(UtilityHelper.EmptyGuid, PERM_LEVEL.SEE)} />
                <DropDownItem width={width} name={"Control"} icon={check(UtilityHelper.EmptyGuid, PERM_LEVEL.CONTROL)} onClick={() => SetPermission(UtilityHelper.EmptyGuid, PERM_LEVEL.CONTROL)} />
                <DropDownItem width={width} name={"Edit"}    icon={check(UtilityHelper.EmptyGuid, PERM_LEVEL.EDIT)}    onClick={() => SetPermission(UtilityHelper.EmptyGuid, PERM_LEVEL.EDIT)} />
                <DropDownItem width={width} name={"None"}    icon={check(UtilityHelper.EmptyGuid, PERM_LEVEL.NONE)}    onClick={() => SetPermission(UtilityHelper.EmptyGuid, PERM_LEVEL.NONE)} />
              </DropDownMenu>
            </DropDownMenu>
          </>
        ) : (
          <>
            <DropDownMenu
              submenu={true}
              width={width}
              name={"Add"}
              icon={<FaPlus/>}
            ></DropDownMenu>
            <DropDownItem
              width={width}
              name={"Paste"}
              icon={<FaPaste/>}
              onClick={() => PasteElements()}
            />
            <DropDownMenu
              submenu={true}
              width={width}
              name={"Battle Map"}
              icon={<FaMap/>}
            >
              <DropDownMenu gmOnly submenu={true} width={width} name={"Show"} icon={<FaEye />}>
                <DropDownItem width={width} name={"All players"} onClick={() => ShowBattleMap()} />
                {GetPlayersForPermissions().map(player => (
                  <DropDownItem key={player.id} width={width} name={player.name || player.id}
                    onClick={() => ShowBattleMap(player.id)} />
                ))}
              </DropDownMenu>
              <DropDownItem
                width={width}
                name={"Tools"}
                onClick={HandleSpawnTools}
                icon={<FaWrench/>}
              />
            </DropDownMenu>
            {maps.length > 0 && (
              <DropDownMenu submenu={true} width={width} name={"Switch Map"} icon={<FaExchangeAlt />}>
                {maps.map(m => (
                  <DropDownItem key={m.id} width={width} name={m.name} onClick={() =>
                    ClientMediator.sendCommand("BattleMap", "ChangeMap", { contextId: battleMapId, id: m.id })
                  } />
                ))}
              </DropDownMenu>
            )}
            {canEditMap && (
              <DropDownItem
                width={width}
                name={"Map Settings"}
                onClick={HandleSpawnMapSettings}
                icon={<FaCog/>}
              />
            )}
            {canEditMap && (
              <DropDownItem
                width={width}
                name={"Edit Grid"}
                onClick={() => {
                  ClientMediator.sendCommand("BattleMap", "EditGrid", {contextId: battleMapId})
                }}
                icon={<FaWrench/>}
              />
            )}
          </>
        )}
      </MenuContent>
    </MenuRoot>
  );
};
export default BattleMapContextMenu;
