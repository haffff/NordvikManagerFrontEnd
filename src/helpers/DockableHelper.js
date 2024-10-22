import * as Dockable from "@hlorenzi/react-dockable"

export const DockableHelper = {
    NewFloating: (state,Element) => {
        let panel = Dockable.spawnFloating(state, Element);
        state.commit();
        return panel;
    },
}

export default DockableHelper;