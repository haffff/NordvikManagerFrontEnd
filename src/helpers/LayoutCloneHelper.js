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
                if(x !== null && x !== undefined)
                    return {contentId: x, element:createElement(contentsToPaste.filter(y=> y.contentId === x)[0])};
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
        let clonedObject = JSON.parse(jsonString);
        let loadedState = LayoutHelper.LoadElementsPanel(clonedObject,createElement,clonedObject._contents);
        console.warn(state.ref.current);
        state.ref.current.rootPanel = loadedState;
        state.ref.current.idNext = clonedObject._contents.sort((x) => x.id).at(-1)?.contentId ?? 1;
        state.commit();
    }
}

export default LayoutHelper;