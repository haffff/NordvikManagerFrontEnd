import ClientMediator from "../../../../ClientMediator";

export class OnPermissionsChangedBehavior {
    async Handle(response, canvas, battleMapId) {
        const { data } = response;

        if(data.entityType === "MapModel")
        {
            await ClientMediator.sendCommandAsync("BattleMap", "ReloadBattleMapComponent", { contextId: battleMapId });
        }

        if(data.entityType !== "ElementModel")
        {
            return;
        }

        let obj = canvas.getObjects().find(x => x.id === data.id);
        if (!obj) {
            await ClientMediator.sendCommandAsync("BattleMap", "ReloadBattleMapComponent", { contextId: battleMapId });
            return;
        }

        ClientMediator.sendCommandWaitForRegister("Game", "GetCurrentPlayer", {}, true).then((currentPlayer) => {
            let permission = data.permissions[currentPlayer.id];
            let canControl = (permission & 4) == 4;

            obj.set('selectablePermission', canControl);
            obj.set('permission', permission);
            obj.set('selectable', obj.selectablePermission && obj.layer == ClientMediator.sendCommand("BattleMap", "GetSelectedLayer", { contextId: battleMapId }));
            obj.set('visible', (permission & 1) == 1);

            canvas.requestRenderAll();
        });
    }
}