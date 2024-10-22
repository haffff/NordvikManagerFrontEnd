import { fabric } from 'fabric';
import UtilityHelper from '../../../../helpers/UtilityHelper';

export class OnTokenSelectedClientBehavior {
    Handle(event, canvas, map, keyboardEventsManagerRef, battleMapObject) {
        let oldSelections = event.deselected;
        oldSelections?.forEach(element => {
            if(element.properties === undefined)
            {
                return;
            }

            let isToken = UtilityHelper.ParseBool(element.properties["isToken"]?.value);
            if (!isToken) {
                return;
            }

            if (element && element.additionalObjects) {
                let objects = element.additionalObjects.filter(x => x.showOnTokenControl);
                objects.forEach(element => {
                    element.animate('opacity', 0, {
                        duration: 400,
                        easing: fabric.util.ease.easeOutBounce,
                        onChange: canvas.renderAll.bind(canvas),
                        onComplete: () => {
                            element.set({ visible: false });
                        }
                    });
                });
            }
        });

        if (event.selected?.length !== 1) {
            return;
        }

        let token = event.selected[0];

        if (!token || !token.properties || !UtilityHelper.ParseBool(token.properties["isToken"]?.value)) {
            return;
        }

        let objects = token.additionalObjects?.filter(x => x.showOnTokenControl) || [];

        objects.forEach(element => {
            element.set({ visible: true });
            element.animate('opacity', 1, {
                onChange: canvas.renderAll.bind(canvas),
                duration: 400,
                easing: fabric.util.ease.easeOutBounce,
            });
        });

    }
}