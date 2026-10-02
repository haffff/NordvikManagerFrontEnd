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

        // _maskVisible is computed by TokenManager.UpdateTokenBasedOnProperties from
        // this element's maskGroup (map-wide toggle, with an optional per-token
        // override) — a showOnTokenControl element that's currently masked off must
        // stay hidden even on selection, not just when deselected.
        let objects = token.additionalObjects?.filter(
            x => x?.tokenData?.showOnTokenControl && x._maskVisible !== false
        ) || [];

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