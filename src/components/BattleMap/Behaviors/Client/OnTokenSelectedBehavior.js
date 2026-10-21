import { fabric } from 'fabric';
import ClientMediator from '../../../../ClientMediator';

// Collapsed status icons (see TokenManager.UpdateTokenUIPositions) unfold while the
// token is the only one selected.
const setIconsExpanded = (token, expanded, battleMapId) => {
    if (!!token._iconsExpanded === expanded) return;
    token._iconsExpanded = expanded;
    ClientMediator.sendCommand("BattleMap_Token", "UpdateTokenUIPositions", { object: token, contextId: battleMapId });
};

export class OnTokenSelectedClientBehavior {
    Handle(event, canvas, map, battleMapId) {
        let oldSelections = event.deselected;
        oldSelections?.forEach(element => {
            let isToken = element.tokenData !== undefined;
            if (!isToken) {
                return;
            }

            setIconsExpanded(element, false, battleMapId);
            // Read by TokenManager.UpdateTokenBasedOnProperties, which would otherwise
            // hide the on-selection parts of a token that is still selected.
            element._controlsShown = false;

            if (element && element.additionalObjects) {
                const token = element;
                let objects = element.additionalObjects.filter(x => x?.tokenData?.showOnTokenControl);
                objects.forEach(element => {
                    element.animate('opacity', 0, {
                        duration: 100,
                        easing: fabric.util.ease.easeOutSine,
                        onChange: canvas.renderAll.bind(canvas),
                        onComplete: () => {
                            // Selected again before the fade ended: keep it.
                            if (!token._controlsShown) element.set({ visible: false });
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

        setIconsExpanded(token, true, battleMapId);
        token._controlsShown = true;

        // _maskVisible is computed by TokenManager.UpdateTokenBasedOnProperties from
        // this element's maskGroup (map-wide toggle, with an optional per-token
        // override) — a showOnTokenControl element that's currently masked off must
        // stay hidden even on selection, not just when deselected.
        let objects = token.additionalObjects?.filter(
            x => x?.tokenData?.showOnTokenControl && x._maskVisible !== false
        ) || [];

        objects.forEach(element => {
            fabric.runningAnimations?.cancelByTarget(element); // a fade-out still running
            element.set({ visible: true });
            element.animate('opacity', 1, {
                onChange: canvas.renderAll.bind(canvas),
                duration: 100,
                easing: fabric.util.ease.easeInSine,
            });
        });

    }
}