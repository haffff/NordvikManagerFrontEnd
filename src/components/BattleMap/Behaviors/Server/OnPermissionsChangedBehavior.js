import ClientMediator from "../../../../ClientMediator";
import { canSee, canControl, PERM, ENTITY_TYPES } from "../../Helpers/permissionBits";

const EVERYONE_ID = '00000000-0000-0000-0000-000000000000';

const isSet = (bits) => typeof bits === 'number' && bits >= 0;

/**
 * The player's bits from a permission_update, read like the server does: their own row,
 * else the "everyone" row; "not set" (-1) means no row. Undefined when the update names
 * neither (it's about other players only).
 */
export const effectivePermission = (permissions, playerId) => {
  const own = permissions?.[playerId];
  if (isSet(own)) return own;
  const everyone = permissions?.[EVERYONE_ID];
  if (isSet(everyone)) return everyone;
  if (own === undefined && everyone === undefined) return undefined;
  return PERM.NONE;
};

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
                // The game's own permission is what makes a co-GM, so only the owner skips it
                // there; on everything else a GM (owner or co-GM) has every right.
                const isGM = data.entityType === ENTITY_TYPES.GAME
                    ? currentPlayer?.id != null && currentPlayer.id === ClientMediator.sendCommand("Game", "GetOwner")
                    : ClientMediator.sendCommand("Game", "GetIsGM");
                const bits = isGM ? PERM.ALL : effectivePermission(data.permissions, currentPlayer?.id);
                if (bits === undefined) return;
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
            let permission = isGM ? PERM.ALL : (effectivePermission(data.permissions, currentPlayer.id) ?? PERM.NONE);

            obj.set('selectablePermission', canControl(permission));
            obj.set('permission', permission);
            obj.set('selectable', canControl(permission) && obj.layer == ClientMediator.sendCommand("BattleMap", "GetSelectedLayer", { contextId: battleMapId }));
            obj.set('visible', canSee(permission));

            canvas.requestRenderAll();
        });
    }
}