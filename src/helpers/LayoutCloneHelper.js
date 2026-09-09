import ClientMediator from "../ClientMediator";

export const LayoutHelper = {

    // Resolves a rendered panel's component type -> its stable PanelsList key.
    // Injected by Game.js (SetPanelKeyResolver) to avoid a PanelsList <->
    // LayoutsManagerPanel <-> LayoutCloneHelper import cycle. The default falls
    // back to the function name, which is mangled in production builds — hence
    // the injected resolver, which matches by component identity.
    _resolvePanelKey: (elementType) => elementType?.type?.name ?? elementType?.name,
    SetPanelKeyResolver(fn) {
        if (typeof fn === "function") LayoutHelper._resolvePanelKey = fn;
    },

    GetCloneForSaving: (rootPanel, battleMaps) => {
        delete rootPanel["_contents"];
        let elementsDict = [];
        let res = LayoutHelper.ParsePanel(rootPanel, elementsDict);
        res["_contents"] = elementsDict.map(x => {
            const battlemapObj = Object.values(battleMaps ?? {}).find(bm => bm.PanelContentID === x.id);
            let bmId = undefined;
            let mapId = undefined;
            if (battlemapObj !== undefined) {
                bmId = battlemapObj.id;  // fixed: was .Id (wrong case)
                try {
                    // Can throw if the BattleMap context is mid-teardown (e.g. during beforeunload).
                    mapId = ClientMediator.sendCommand("BattleMap", "GetSelectedMapID", { contextId: bmId });
                } catch (e) {
                    console.warn("LayoutHelper.GetCloneForSaving: GetSelectedMapID failed", e);
                }
            }

            // Save serializable props only — skip undefined, functions,
            // React refs (.current) and dockable state (.ref).
            const propsObject = {};
            Object.entries(x.content.element.props).forEach(([key, val]) => {
                if (val === undefined || typeof val === 'function') return;
                if (val !== null && typeof val === 'object' && ('current' in val || 'ref' in val)) return;
                propsObject[key] = val;
            });

            return {
                contentId: x.id,
                type: LayoutHelper._resolvePanelKey(x.content.element.type),
                syncId: bmId,
                mapId: mapId,
                props: propsObject
            };
        });

        return res;
    },

    // Non-mutating variant for automatic/background saves — never touches the live
    // state.ref.current.rootPanel, and swallows any failure (returns null).
    GetCloneForSavingSafe: (rootPanel, battleMaps) => {
        if (!rootPanel) return null;
        try {
            const { _contents, ...copy } = rootPanel;
            return LayoutHelper.GetCloneForSaving(copy, battleMaps);
        } catch (e) {
            console.warn("LayoutHelper.GetCloneForSavingSafe: failed to serialize layout", e);
            return null;
        }
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
            obj.contentList = obj.contentList.reduce((acc, x) => {
                if (x === null || x === undefined) return acc;
                const contentToUse = contentsToPaste.find(y => y.contentId === x);
                try {
                    const element = createElement(contentToUse);
                    if (!element) {
                        console.warn('LayoutHelper.LoadElementsPanel: createElement returned null/undefined for content', { contentId: x, contentToUse });
                        return acc;
                    }
                    acc.push({ contentId: x, element });
                } catch (e) {
                    console.error('LayoutHelper.LoadElementsPanel: createElement threw for content', { contentId: x, contentToUse, error: e });
                }
                return acc;
            }, []);
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

            // Collect ALL IDs across every source so idNext never reuses one:
            //   1. Content IDs from the saved layout's _contents
            //   2. Panel IDs + content IDs from the newly restored rootPanel tree
            //   3. Panel IDs + content IDs from any surviving floatingPanels
            // (The dockable library draws panel IDs *and* content IDs from the same
            //  idNext counter, so both must be considered.)
            const allIds = [];

            const collectIds = (panel) => {
                if (!panel) return;
                if (typeof panel.id === 'number') allIds.push(panel.id);
                for (const c of (panel.contentList || [])) {
                    if (typeof c.contentId === 'number') allIds.push(c.contentId);
                }
                for (const sp of (panel.splitPanels || [])) collectIds(sp);
            };

            for (const c of contents) {
                const id = c.contentId ?? c.id ?? 0;
                if (typeof id === 'number') allIds.push(id);
            }
            collectIds(loadedState);
            for (const fp of (state.ref.current.floatingPanels || [])) {
                collectIds(fp);
            }

            const maxId = allIds.length > 0 ? Math.max(...allIds) : 0;
            state.ref.current.idNext = (maxId || 0) + 1;
            state.commit();
        } catch (e) {
            console.error('LayoutHelper.LoadLayoutState: failed to apply layout to state', e, { loadedState, contents });
        }
    }
}

export default LayoutHelper;