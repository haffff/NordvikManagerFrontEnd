import ClientMediator from "../../../../ClientMediator";
import { canSee, canControl, PERM, ENTITY_TYPES } from "../../Helpers/permissionBits";

const EVERYONE_ID = '00000000-0000-0000-0000-000000000000';

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
                const bits = isGM ? PERM.ALL : (data.permissions?.[currentPlayer?.id] ?? data.permissions?.[EVERYONE_ID] ?? PERM.NONE);
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
            let permission = isGM ? PERM.ALL : (data.permissions?.[currentPlayer.id] ?? data.permissions?.[EVERYONE_ID] ?? PERM.NONE);

            obj.set('selectablePermission', canControl(permission));
            obj.set('permission', permission);
            obj.set('selectable', canControl(permission) && obj.layer == ClientMediator.sendCommand("BattleMap", "GetSelectedLayer", { contextId: battleMapId }));
            obj.set('visible', canSee(permission));

            canvas.requestRenderAll();
        });
    }
}