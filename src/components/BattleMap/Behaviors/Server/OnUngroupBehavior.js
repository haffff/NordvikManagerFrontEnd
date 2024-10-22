import { fabric } from 'fabric';
import DTOConverter from '../../DTOConverter';

export class OnUngroupBehavior {
    Handle(response, canvas) {
        let objects = canvas.getObjects().filter(x => response.elementIds.includes(x.id));
        objects.forEach(element => {
            canvas.remove(element);
        });
        
        fabric.util.enlivenObjects(response.data.map(x => DTOConverter.ConvertFromDTO(x)), (e) => {
            e.forEach(element => {
                canvas.add(element);
            });
        });
    }
}