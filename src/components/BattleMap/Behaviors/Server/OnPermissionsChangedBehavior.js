import ClientMediator from "../../../../ClientMediator";
import { canSee, canControl, PERM, ENTITY_TYPES } from "../../Helpers/permissionBits";

export class OnPermissionsChangedBehavior {
    async Handle(response, canvas, battleMapId) {
        const { data } = response;

        if(data.entityType === "MapModel")
        {
            await ClientMediator.sendCommandAsync("BattleMap", "ReloadBattleMapComponent", { contextId: battleMapId });
        }

        // For non-element entities (Map, Game, etc.) push updated bits into PermissionsContext
        if(data.entityType !== "ElementModel")
        {
            ClientMediator.sendCommandWaitForRegister("Game", "GetCurrentPlayer", {}, true).then((currentPlayer) => {
                const isGM = ClientMediator.sendCommand("Game", "GetIsGM");
                const bits = isGM ? PERM.ALL : (data.permissions?.[currentPlayer?.id] ?? PERM.NONE);
                ClientMediator.sendCommand("Game", "UpdateEntityPermission", {
                    entityType: data.entityType,
                    entityId: data.id,
                    bits,
                });
            });
            return;
        }

        let obj = canvas.getObjects().find(x => x.id === data.id);
        if (!obj) {
            await ClientMediator.sendCommandAsync("BattleMap", "ReloadBattleMapComponent", { contextId: battleMapId });
            return;
        }

        ClientMediator.sendCommandWaitForRegister("Game", "GetCurrentPlayer", {}, true).then((currentPlayer) => {
            const isGM = ClientMediator.sendCommand("Game", "GetIsGM");
            let permission = isGM ? PERM.ALL : (data.permissions[currentPlayer.id] ?? PERM.NONE);

            obj.set('selectablePermission', canControl(permission));
            obj.set('permission', permission);
            obj.set('selectable', canControl(permission) && obj.layer == ClientMediator.sendCommand("BattleMap", "GetSelectedLayer", { contextId: battleMapId }));
            obj.set('visible', canSee(permission));

            // Visual indicator: colored border if any non-GM player has control
            const allPlayers = ClientMediator.sendCommand("Game", "GetPlayers") || [];
            const controllingPlayer = allPlayers.find(
                (p) => p.id !== currentPlayer.id && canControl(data.permissions?.[p.id] ?? PERM.NONE)
            );
            if (controllingPlayer) {
                obj.set('stroke', controllingPlayer.color || '#ffffff');
                obj.set('strokeWidth', 3);
            } else {
                obj.set('stroke', null);
                obj.set('strokeWidth', 0);
            }

            canvas.requestRenderAll();
        });
    }
}