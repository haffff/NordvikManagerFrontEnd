import { fabric } from 'fabric';
import DTOConverter from '../../DTOConverter';
import ClientMediator from '../../../../ClientMediator';

export class OnAddElementBehavior {
    Handle(response, canvas, battleMapId) {
        let mapId = ClientMediator.sendCommand("BattleMap","GetSelectedMapID", {contextId: battleMapId});
        let selectedLayer = ClientMediator.sendCommand("BattleMap","GetSelectedLayer", {contextId: battleMapId});
        if (mapId === response.data.mapId) {
            let value = DTOConverter.ConvertFromDTO(response.data);
            value.selectable = (response.data.permission & 4) == 4 && response.data.layer == selectedLayer;
            fabric.util.enlivenObjects([value], (e) => {
                e.forEach(element => {
                    let found = canvas._objects.findIndex(x => x.layer >= element.layer);
                    if (found == -1) {
                        canvas.add(element);
                    }
                    else {
                        if(!element.properties)
                        {
                            element.properties = [];
                        }
                        canvas.insertAt(element, found);
                    }
                });
            });
        }
    }
}