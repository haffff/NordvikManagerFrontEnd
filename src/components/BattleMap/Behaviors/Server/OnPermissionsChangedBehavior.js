import ClientMediator from "../../../../ClientMediator";

export class OnPermissionsChangedBehavior {
    Handle(response, canvas, battleMapId) {
        const { data } = response;
        let obj = canvas.getObjects().find(x => x.id === data.id);
        if (!obj) {
            return;
        }

        ClientMediator.sendCommandAsync("Game", "GetCurrentPlayer", {}, true).then((currentPlayer) => {
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