import ClientMediator from "../ClientMediator";

export const LayoutHelper = {

    GetCloneForSaving: (rootPanel, battleMaps) => {
        delete rootPanel["_contents"];
        let elementsDict = [];
        let res = LayoutHelper.ParsePanel(rootPanel, elementsDict);
        res["_contents"] = elementsDict.map(x => {
            let battlemapObj = Object.values(battleMaps).filter(bm => bm.PanelContentID === x.id)[0];
            let bmId = undefined;
            let mapId = undefined;
            if (battlemapObj !== undefined) {
                bmId = battlemapObj.Id;
                mapId = ClientMediator.sendCommand("Battlemap", "GetSelectedMapID", {contextId: bmId});
            }

            let propsObject = {};
            //We are saving props WITHOUT refs! refs causes UE and doesn't make any sense
            Object.keys(x.content.element.props).forEach(key =>
                 propsObject[key] = x.content.element.props[key] !== undefined && x.content.element.props[key].current === undefined && x.content.element.props[key].ref === undefined ? x.content.element.props[key] : undefined);

            return {
                contentId: x.id,
                type: x.content.element.type.name,
                syncId: bmId,
                mapId: mapId,
                props: propsObject
            };
        });

        return res;
    },

    ParsePanel: (panel, elementsDict) => {
        let result = {};
        Object.keys(panel).forEach(key => {
            if (key === "splitPanels") {
                result[key] = panel[key].map(panel => LayoutHelper.ParsePanel(panel, elementsDict));
            }
            else if (key === "contentList") {
                result[key] = panel[key].map(content => {
                    elementsDict.push({ id: content.contentId, content });
                    return content.contentId;
                });
            }
            else {
                result[key] = panel[key];
            }
        });

        return result;
    },
    LoadElementsPanel: (obj, createElement, contentsToPaste) => {
        if (obj.contentList !== undefined) {
            obj.contentList = obj.contentList.map(x => {
                if(x !== null && x !== undefined) {
                    const contentToUse = contentsToPaste.filter(y => y.contentId === x)[0];
                    try {
                        const element = createElement(contentToUse);
                        if (!element) {
                            console.warn('LayoutHelper.LoadElementsPanel: createElement returned null/undefined for content', { contentId: x, contentToUse });
                            return { contentId: x, element: undefined };
                        }
                        return { contentId: x, element };
                    } catch (e) {
                        console.error('LayoutHelper.LoadElementsPanel: createElement threw for content', { contentId: x, contentToUse, error: e });
                        return { contentId: x, element: undefined };
                    }
                }
                return undefined;
            });
        }
        if (obj.splitPanels !== undefined) {
            obj.splitPanels = obj.splitPanels.map(x => LayoutHelper.LoadElementsPanel(x,createElement,contentsToPaste));
        }
        return obj;
    },
    LoadLayoutState: (state, jsonString, createElement) =>
    {
        if(jsonString === undefined || jsonString === null)
        {
            return;
        }

        let clonedObject;
        try {
            if (typeof jsonString === 'string') {
                clonedObject = JSON.parse(jsonString);
            } else if (typeof jsonString === 'object') {
                // already parsed/object
                clonedObject = jsonString;
            } else {
                console.warn('LayoutHelper.LoadLayoutState: unsupported layout format', { jsonString });
                return;
            }
        } catch (e) {
            console.error('LayoutHelper.LoadLayoutState: failed to parse layout JSON', e, { jsonString });
            return;
        }

        const contents = clonedObject._contents || [];
        const loadedState = LayoutHelper.LoadElementsPanel(clonedObject, createElement, contents);

        if (!state || !state.ref || !state.ref.current) {
            console.warn('LayoutHelper.LoadLayoutState: state.ref.current is not available, cannot apply layout', { state });
            return;
        }

        try {
            state.ref.current.rootPanel = loadedState;

            // Compute next content id safely from saved contents
            const maxId = contents.length > 0 ? Math.max(...contents.map(c => (c.contentId ?? c.id ?? 0))) : 0;
            state.ref.current.idNext = (maxId || 0) + 1;
            state.commit();
        } catch (e) {
            console.error('LayoutHelper.LoadLayoutState: failed to apply layout to state', e, { loadedState, contents });
        }
    }
}

export default LayoutHelper;