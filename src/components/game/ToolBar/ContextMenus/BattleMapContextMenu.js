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
  FaLockOpen,
  FaMap,
  FaObjectUngroup,
  FaPaste,
  FaPlus,
  FaShieldAlt,
  FaTags,
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
import SwitchMapSubmenu from "./SwitchMapSubmenu";
import { MenuContent, MenuContextTrigger, MenuRoot } from "../../../ui/menu";
import { PERM, PERM_LEVEL, ENTITY_TYPES } from "../../../BattleMap/Helpers/permissionBits";
import CommandFactory from "../../../BattleMap/Factories/CommandFactory";
import UtilityHelper from "../../../../helpers/UtilityHelper";
import { usePermissions } from "../../../../contexts/PermissionsContext";
import { Tooltip } from "../../../ui/tooltip";
import { RESERVED_LAYERS } from "../../../BattleMap/Constants/layers";
import { useCustomLayers } from "../../../uiComponents/hooks/useCustomLayers";
import { syncControlsVisibility } from "../../../BattleMap/Helpers/TokenControlsHelper";
import { SearchInput } from "../../../uiComponents/SearchInput";

export const BattleMapContextMenu = ({ width, battleMapId, canvas, children }) => {
  const selectedObjects = canvas?.getActiveObjects() || [];
  const { hasEntityPermission, isGM } = usePermissions();

  // Resolve the current map id for entity-level permission checks
  const currentMap = ClientMediator.sendCommand("BattleMap", "GetSelectedMap", { contextId: battleMapId });
  const canEditMap = hasEntityPermission(ENTITY_TYPES.MAP, currentMap?.id, PERM.EDIT);

  const gameId = React.useMemo(() => ClientMediator.sendCommand("Game", "GetGameId"), []);
  const { layers } = useCustomLayers(gameId);

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

  // Base-platform "Token" shortcut (Add submenu) — spawns a token from an
  // EXISTING card, no card creation involved. Generic/game-system-agnostic
  // (any card with a "token" property qualifies, addon or not), unlike the
  // "Item"/"Monster" entries next to it which are addon-contributed and
  // create a new card first. See BattleMapContextMenu's own PasteElements
  // for the same canvas.lastAbsolutePointer usage this reuses for position.
  const [allCards, setAllCards] = React.useState([]);
  const [tokenCardIds, setTokenCardIds] = React.useState(() => new Set());

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const cards = await WebHelper.getAsync('materials/getcards').catch(() => null);
      if (!cards?.length) { if (!cancelled) { setAllCards([]); setTokenCardIds(new Set()); } return; }
      const ids = cards.map(c => c.id).join(',');
      const props = await WebHelper
        .getAsync(`properties/QueryProperties?parentIds=${ids}&names=token`)
        .catch(() => null);
      const withToken = new Set((props ?? []).filter(p => p.value).map(p => p.parentId));
      if (!cancelled) { setAllCards(cards); setTokenCardIds(withToken); }
    })();
    return () => { cancelled = true; };
  }, []);

  // Bug fix: the batch load above only ever ran once on mount, so a card
  // created while this context menu was already open never got its "token"
  // property checked and could never appear in the picker until a reload.
  // CardsPanel.js's own CollectionSyncer usage is the established pattern for
  // keeping a card list live — extended here to also check each newly added
  // card's token property individually as it arrives.
  const handleCardAdded = (card) => {
    WebHelper.getAsync(`properties/QueryProperties?parentIds=${card.id}&names=token`)
      .then((props) => {
        if ((props ?? []).some(p => p.value)) {
          setTokenCardIds(prev => new Set(prev).add(card.id));
        }
      })
      .catch(() => {});
  };

  const handleCardDeleted = (cardId) => {
    setTokenCardIds(prev => {
      if (!prev.has(cardId)) return prev;
      const next = new Set(prev);
      next.delete(cardId);
      return next;
    });
  };

  const tokenizableCards = React.useMemo(
    () => allCards.filter(c => tokenCardIds.has(c.id)),
    [allCards, tokenCardIds]
  );

  // A GM/player can easily have 50+ cards — filter client-side rather than
  // rendering every tokenizable card as a flat menu row.
  const [tokenSearch, setTokenSearch] = React.useState("");
  const filteredTokenizableCards = React.useMemo(() => {
    const q = tokenSearch.trim().toLowerCase();
    if (!q) return tokenizableCards;
    return tokenizableCards.filter(c => c.name?.toLowerCase().includes(q));
  }, [tokenizableCards, tokenSearch]);

  const SpawnTokenFromCard = (cardId) => {
    ClientMediator.sendCommand('BattleMap_token', 'CreateToken', {
      contextId: battleMapId,
      cardId,
      position: canvas.lastAbsolutePointer,
    });
  };

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

  // Tokens can opt out of scaling/rotating via their own corner/rotate handles —
  // fabric.js respects these flags natively, so this is just a toggle + a
  // minified sync, no server-side changes needed.
  const isTokenControlsLocked = (obj) =>
    !!(obj?.lockScalingX || obj?.lockScalingY || obj?.lockRotation);

  const ToggleTokenControlsLock = () => {
    const obj = selectedObjects[0];
    if (!obj) return;
    const locked = !isTokenControlsLocked(obj);
    obj.set({
      lockScalingX: locked,
      lockScalingY: locked,
      lockRotation: locked,
    });
    syncControlsVisibility(obj);
    canvas.requestRenderAll();
    const dto = DTOConverter.ConvertToDTOMinified(obj, [
      "lockScalingX",
      "lockScalingY",
      "lockRotation",
    ]);
    WebSocketManagerInstance.Send({
      command: "element_update",
      data: dto,
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
      <Subscribable commandPrefix="permission_update" onMessage={(msg) => {
        if (msg.data?.entityType !== 'ElementModel' || msg.data?.id !== selectedId) return;
        setElementPermissions(msg.data.permissions ?? {});
      }} />
      <CollectionSyncer collection={maps} setCollection={setMaps} commandPrefix="map" />
      <CollectionSyncer
        collection={allCards}
        setCollection={setAllCards}
        commandPrefix="card"
        onAdd={handleCardAdded}
        onDelete={handleCardDeleted}
      />
      <MenuContextTrigger >{children}</MenuContextTrigger>
      <MenuContent>
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
            {canEditMap && (
              <DropDownMenu submenu={true} width={width} name={"More Actions"}>
                <DropDownItem
                  width={width}
                  name={"Ungroup"}
                  onClick={() => SwitchLayer(RESERVED_LAYERS.MAP)}
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
            )}
            {canEditMap && (
              <DropDownMenu
                submenu={true}
                width={width}
                name={"Move to layer"}
                icon={FaLayerGroup}
              >
                {layers.filter((l) => l.kind !== "reserved-grid").map((l) => (
                  <DropDownItem
                    key={l.key}
                    width={width}
                    name={l.name}
                    onClick={() => SwitchLayer(l.layerId)}
                    icon={l.kind === "reserved-token" ? FaChess : l.kind === "reserved-map" ? FaMap : FaLayerGroup}
                  />
                ))}
              </DropDownMenu>
            )}
            <DropDownItem
              width={width}
              name={"Properties"}
              onClick={HandleSpawnProperties}
              icon={FaWrench}
            />
            {selectedObjects[0]?.isToken && selectedObjects[0]?.tokenData?.assignableIcons?.length > 0 && (
              <DropDownItem
                width={width}
                name={"Manage Icons"}
                onClick={() => ClientMediator.sendCommand("BattleMap", "ShowIconPicker", {
                  contextId: battleMapId,
                  tokenId: selectedObjects[0].id,
                })}
                icon={FaTags}
              />
            )}
            {selectedObjects[0]?.isToken && (
              <DropDownItem
                width={width}
                name={
                  isTokenControlsLocked(selectedObjects[0])
                    ? "Unlock Scale/Rotate"
                    : "Lock Scale/Rotate"
                }
                onClick={ToggleTokenControlsLock}
                icon={isTokenControlsLocked(selectedObjects[0]) ? FaLock : FaLockOpen}
              />
            )}
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
            {canEditMap && (
              <DropDownMenu
                viewId={"battlemap_add"}
                submenu={true}
                width={width}
                name={"Add"}
                icon={<FaPlus/>}
              >
                {tokenizableCards.length > 0 && (
                  <DropDownMenu submenu={true} width={width} name={"Token"} icon={<FaChess/>}>
                    {/* A GM/player can easily have 50+ tokenizable cards — stopPropagation
                        keeps typing/clicking from being swallowed as menu item navigation
                        (arrow-key/typeahead selection) or triggering the menu's closeOnSelect. */}
                    <div
                      style={{ padding: "4px 6px" }}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <SearchInput value={tokenSearch} onChange={setTokenSearch} />
                    </div>
                    {filteredTokenizableCards.map((card) => (
                      <DropDownItem
                        key={card.id}
                        width={width}
                        name={card.name}
                        onClick={() => SpawnTokenFromCard(card.id)}
                      />
                    ))}
                  </DropDownMenu>
                )}
              </DropDownMenu>
            )}
            {canEditMap && (
              <DropDownItem
                width={width}
                name={"Paste"}
                icon={<FaPaste/>}
                onClick={() => PasteElements()}
              />
            )}
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
            {maps.length > 0 && canEditMap && (
              <SwitchMapSubmenu maps={maps} battleMapId={battleMapId} currentMapId={currentMap?.id} width={width} />
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
