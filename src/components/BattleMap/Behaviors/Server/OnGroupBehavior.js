import { fabric } from 'fabric';
import DTOConverter from '../../DTOConverter';
import ClientMediator from '../../../../ClientMediator';
import { canControl } from '../../Helpers/permissionBits';

export class OnGroupBehavior {
    Handle(response, canvas, battleMapId) {
        let objects = canvas.getObjects().filter(x => response.elementIds.includes(x.id));

        objects.forEach(element => {
            canvas.remove(element);
        });

        let finalObject = DTOConverter.ConvertFromDTO(response.data);
        let selectedLayer = ClientMediator.sendCommand("BattleMap","GetSelectedLayer", {contextId: battleMapId});
        fabric.util.enlivenObjects([finalObject], (e) => {
            e.forEach(element => {
                element.id = response.data.id;
                element.selectable = canControl(response.data.permission) && response.data.layer == selectedLayer;

                // Strict '>' so the regrouped element lands on top of any existing
                // same-layer objects (newest-on-top), same fix as OnAddElementBehavior.
                let found = canvas._objects.findIndex(x => x.layer > element.layer);
                if (found == -1) {
                    if (!element.properties) {
                        element.properties = [];
                    }
                    canvas.add(element);
                }
                else {
                    canvas.insertAt(element, found);
                }

                ClientMediator.sendCommandWaitForRegister("Game","GetCurrentPlayer", {},true).then((currentPlayer) => {
                    if (response.playerId === currentPlayer.id) {
                        canvas.setActiveObject(element);
                    }
                    canvas.requestRenderAll();
                });
            });
        });
        canvas.requestRenderAll();
    }
}