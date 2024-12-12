import { fabric } from 'fabric';

export class OnTokenSelectedClientBehavior {
    Handle(event, canvas, map) {
        let oldSelections = event.deselected;
        oldSelections?.forEach(element => {
            let isToken = element.tokenData !== undefined;
            if (!isToken) {
                return;
            }

            if (element && element.additionalObjects) {
                let objects = element.additionalObjects.filter(x => x?.tokenData?.showOnTokenControl);
                objects.forEach(element => {
                    element.animate('opacity', 0, {
                        duration: 100,
                        easing: fabric.util.ease.easeOutSine,
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

        if (!token || !token.tokenData) {
            return;
        }

        let objects = token.additionalObjects?.filter(x => x?.tokenData?.showOnTokenControl) || [];

        objects.forEach(element => {
            element.set({ visible: true });
            element.animate('opacity', 1, {
                onChange: canvas.renderAll.bind(canvas),
                duration: 100,
                easing: fabric.util.ease.easeInSine,
            });
        });

    }
}