import * as React from 'react';
import { FaCheckCircle, FaExchangeAlt, FaLock, FaMap, FaMapSigns, FaPlus, FaRegCheckCircle, FaShieldAlt, FaTrash } from 'react-icons/fa';
import MapSelector from '../../panels/MapSelector';
import { ActiveWebHelper as WebHelper } from '../../../../helpers/transport';
import DockableHelper from '../../../../helpers/DockableHelper';
import CommandFactory from '../../../BattleMap/Factories/CommandFactory';
import { ActiveTransportManager as WebSocketManagerInstance } from '../../../../helpers/transport';
import DropDownMenu from '../../../uiComponents/base/DDItems/DropDownMenu';
import DropDownItem from '../../../uiComponents/base/DDItems/DropDownItem';
import ClientMediator from '../../../../ClientMediator';
import CollectionSyncer from '../../../uiComponents/base/CollectionSyncer';
import Subscribable from '../../../uiComponents/base/Subscribable';
import { Battlemap } from '../../../BattleMap/Battlemap';
import useClientMediator from '../../../uiComponents/hooks/useClientMediator';
import { usePermissions } from '../../../../contexts/PermissionsContext';
import { ENTITY_TYPES, PERM, PERM_LEVEL } from '../../../BattleMap/helpers/permissionBits';
import UtilityHelper from '../../../../helpers/UtilityHelper';
import { Tooltip } from '../../../ui/tooltip';

export const BattleMapsMenu = ({ state, maps, onCreateBmModalRef }) => {
    const [battleMaps, setBattleMaps] = React.useState(undefined);
    const [openedBattleMapIds, setOpenedBattleMapIds] = React.useState(new Set());
    // Ref tracks IDs submitted for opening but not yet registered in context.
    // Prevents duplicate opens during the async window before state updates.
    const pendingOpenIds = React.useRef(new Set());
    // Tracks whether a BattleMapsChanged event has already updated state.
    // The useEffect fallback should not overwrite a fresher event-driven update.
    const receivedEventRef = React.useRef(false);

    const { hasEntityPermission, isGM } = usePermissions();
    const gameId = React.useMemo(() => ClientMediator.sendCommand("Game", "GetGameId"), []);
    const canEditGame = hasEntityPermission(ENTITY_TYPES.GAME, gameId, PERM.EDIT);

    useClientMediator("BattleMapsMenu", {
        // Use data directly — it is the authoritative 'next' contexts map passed by
        // AddBattleMapContext/DeleteBattleMapContext. Avoids any timing dependency on
        // battleMapsContextsRef being updated before the setTimeout fires.
        onEvent: (event, data) => {
            if (event === "BattleMapsChanged") {
                receivedEventRef.current = true;
                const ids = new Set(Object.keys(data || {}));
                ids.forEach(id => pendingOpenIds.current.delete(id));
                setOpenedBattleMapIds(ids);
            }
        }
    });

    // Fallback: populate on mount by waiting for 'Game' to be ready.
    // Only applies if no BattleMapsChanged event has arrived yet — events
    // carry fresher data (fired after each AddBattleMapContext) and take priority.
    React.useEffect(() => {
        let cancelled = false;
        ClientMediator.sendCommandWaitForRegisterAsync("Game", "GetOpenedBattleMaps", {}, true)
            .then(opened => {
                if (!cancelled && !receivedEventRef.current)
                    setOpenedBattleMapIds(new Set((opened || []).map(x => x.id)));
            });
        return () => { cancelled = true; };
    }, []);

    // { [bmId]: { [playerId]: bits } } — loaded from server, kept live via permission_update
    const [bmPermissions, setBmPermissions] = React.useState({});

    React.useEffect(() => {
        WebHelper.get('battleMap/getBattleMaps', setBattleMaps);
    }, []);

    // Fetch permissions for all battlemaps whenever the list is (re)loaded.
    React.useEffect(() => {
        if (!battleMaps || battleMaps.length === 0) return;
        Promise.all(
            battleMaps.map(bm =>
                WebHelper.getAsync(`security/permissions?entityId=${bm.id}&entityType=BattleMapModel`)
                    .then(perms => ({ id: bm.id, perms: perms ?? {} }))
                    .catch(() => ({ id: bm.id, perms: {} }))
            )
        ).then(results => {
            const next = {};
            results.forEach(({ id, perms }) => { next[id] = perms; });
            setBmPermissions(next);
        });
    }, [battleMaps]);

    if (!battleMaps) return <></>;
    if (!canEditGame) return null;

    const OpenBattleMap = (id) => {
        if (openedBattleMapIds.has(id) || pendingOpenIds.current.has(id)) return;
        pendingOpenIds.current.add(id);
        DockableHelper.NewFloating(state, <Battlemap withID={id} />);
    };

    const DeleteBattleMap = (id) => {
        const cmd = CommandFactory.CreateDeleteBattleMap(id);
        WebSocketManagerInstance.Send(cmd);
    };

    const SetBMPermission = (bmId, playerId, bits) => {
        const cmd = CommandFactory.CreateUpdatePermissionsCommand(bmId, 'BattleMapModel', { [playerId]: bits });
        WebSocketManagerInstance.Send(cmd);
        // Optimistic update so the checkmark reflects the change immediately.
        setBmPermissions(prev => ({
            ...prev,
            [bmId]: { ...(prev[bmId] ?? {}), [playerId]: bits }
        }));
    };

    const GetPlayersForPermissions = () => ClientMediator.sendCommand('Game', 'GetPlayers') || [];

    const BattleMapPermissionsSubmenu = ({ bmId }) => {
        const perms = bmPermissions[bmId] ?? {};
        const check = (playerId, level) =>
        {
            
            let userPermission = perms[playerId] === level
                ? <FaCheckCircle style={{ color: 'var(--chakra-colors-green-400)' }} />
                : null;
            let defaultPermission = perms[playerId] === undefined && perms[UtilityHelper.EmptyGuid] === level
                ? (<Tooltip content={"Everyone has this permission level"}><FaRegCheckCircle style={{ color: 'var(--chakra-colors-green-400)' }} /></Tooltip>)
                : null;

            return (
                <>
                    {userPermission}
                    {defaultPermission}
                </>
            );
        }

        const adminIcon = (playerId) => {
            const bits = perms[playerId];
            return bits > PERM_LEVEL.EDIT
                ? <FaShieldAlt style={{ color: 'orange' }} />
                : undefined;
        };

        return (
            <DropDownMenu submenu={true} width={200} name={"Permissions"} icon={<FaLock />} gmOnly>
                {GetPlayersForPermissions().map(player => (
                    <DropDownMenu key={player.id} submenu={true} width={150} name={player.name || player.id} icon={adminIcon(player.id)}>
                        <DropDownItem width={150} name={"See"}     icon={check(player.id, PERM_LEVEL.SEE)}     onClick={() => SetBMPermission(bmId, player.id, PERM_LEVEL.SEE)} />
                        <DropDownItem width={150} name={"Control"} icon={check(player.id, PERM_LEVEL.CONTROL)} onClick={() => SetBMPermission(bmId, player.id, PERM_LEVEL.CONTROL)} />
                        <DropDownItem width={150} name={"Edit"}    icon={check(player.id, PERM_LEVEL.EDIT)}    onClick={() => SetBMPermission(bmId, player.id, PERM_LEVEL.EDIT)} />
                        <DropDownItem width={150} name={"None"}    icon={check(player.id, PERM_LEVEL.NONE)}    onClick={() => SetBMPermission(bmId, player.id, PERM_LEVEL.NONE)} />
                    </DropDownMenu>
                ))}
                <DropDownMenu submenu={true} width={150} name={"Everyone"} icon={adminIcon(UtilityHelper.EmptyGuid)}>
                    <DropDownItem width={150} name={"See"}     icon={check(UtilityHelper.EmptyGuid, PERM_LEVEL.SEE)}     onClick={() => SetBMPermission(bmId, UtilityHelper.EmptyGuid, PERM_LEVEL.SEE)} />
                    <DropDownItem width={150} name={"Control"} icon={check(UtilityHelper.EmptyGuid, PERM_LEVEL.CONTROL)} onClick={() => SetBMPermission(bmId, UtilityHelper.EmptyGuid, PERM_LEVEL.CONTROL)} />
                    <DropDownItem width={150} name={"Edit"}    icon={check(UtilityHelper.EmptyGuid, PERM_LEVEL.EDIT)}    onClick={() => SetBMPermission(bmId, UtilityHelper.EmptyGuid, PERM_LEVEL.EDIT)} />
                    <DropDownItem width={150} name={"None"}    icon={check(UtilityHelper.EmptyGuid, PERM_LEVEL.NONE)}    onClick={() => SetBMPermission(bmId, UtilityHelper.EmptyGuid, PERM_LEVEL.NONE)} />
                </DropDownMenu>
            </DropDownMenu>
        );
    };

    return (
        <DropDownMenu viewId={"views_battlemaps"} name={"Battle Maps"} submenu={true} icon={<FaMap />} width={200} gmOnly>
            <Subscribable commandPrefix="permission_update" onMessage={(msg) => {
                if (msg.data?.entityType !== 'BattleMapModel') return;
                const bmId = msg.data.id;
                const perms = msg.data.permissions ?? {};
                setBmPermissions(prev => ({ ...prev, [bmId]: perms }));
            }} />
            <CollectionSyncer collection={battleMaps} setCollection={setBattleMaps} commandPrefix={"battlemap"} onAdd={(element, { playerId }) => {
                if (playerId === ClientMediator.sendCommand("Game", "GetCurrentPlayer").id) {
                    OpenBattleMap(element.id);
                }
            }} />
            {battleMaps.map(x => {
                const isOpen = openedBattleMapIds.has(x.id);
                return (
                    <DropDownMenu key={x.id} submenu={true} width={200} name={x.name} icon={isOpen ? <FaCheckCircle style={{ color: 'var(--chakra-colors-green-400)' }} /> : undefined}>
                        {isOpen ? (
                            <DropDownItem width={200} name={"Already open"} icon={<FaCheckCircle />} onClick={() => {}} />
                        ) : (
                            <DropDownItem width={200} name={"Open"} icon={<FaMap />} onClick={() => OpenBattleMap(x.id)} />
                        )}
                        {isOpen && (
                            <DropDownItem width={200} name={"Map Selector"} icon={<FaMapSigns />} onClick={() =>
                                DockableHelper.NewFloating(state, <MapSelector battleMapId={x.id} state={state} />)
                            } />
                        )}
                        {isOpen && maps.length > 0 && (
                            <DropDownMenu submenu={true} width={200} name={"Switch Map"} icon={<FaExchangeAlt />}>
                                {maps.map(m => (
                                    <DropDownItem key={m.id} width={200} name={m.name} onClick={() =>
                                        ClientMediator.sendCommand("BattleMap", "ChangeMap", { contextId: x.id, id: m.id })
                                    } />
                                ))}
                            </DropDownMenu>
                        )}
                        {canEditGame && !isOpen && (
                            <DropDownItem width={200} name={"Delete"} icon={<FaTrash />} onClick={() => DeleteBattleMap(x.id)} />
                        )}
                        {canEditGame && (
                            <BattleMapPermissionsSubmenu bmId={x.id} />
                        )}
                    </DropDownMenu>
                );
            })}
            {canEditGame && (
                <DropDownItem key={'add_new_battlemap'} width={200} name={"Add new"} icon={<FaPlus />} onClick={() => {
                    if (maps.length > 0) {
                        onCreateBmModalRef.current({ name: "New BattleMap", map: maps[0].id });
                    }
                }} />
            )}
        </DropDownMenu>
    );
}

export default BattleMapsMenu;
