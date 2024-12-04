import { fabric } from 'fabric';
import DTOConverter from '../../DTOConverter';
import ClientMediator from '../../../../ClientMediator';

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
                element.selectable = (response.data.permission & 4) == 4 && response.data.layer == selectedLayer;

                let found = canvas._objects.findIndex(x => x.layer >= element.layer);
                if (found == -1) {
                    if (!element.properties) {
                        element.properties = [];
                    }
                    canvas.add(element);
                }
                else {
                    canvas.insertAt(element, found);
                }

                ClientMediator.sendCommandWaitForRegister("Game","GetCurrentPlayer", {},true).then((response) => {
                    if (response.playerId === response.id)
                        canvas.setActiveObject(element);
                        canvas.requestRenderAll();
                });
            });
        });
        canvas.requestRenderAll();
    }
}