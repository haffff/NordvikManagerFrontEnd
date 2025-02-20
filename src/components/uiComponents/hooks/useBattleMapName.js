import React from "react";
import ClientMediator from "../../../ClientMediator";
import useUUID from "./useUUID";

export const useBMName = (bmId) => {
    const [battleMapName, setBattleMapName] = React.useState(undefined);
    const id = useUUID();


    React.useEffect(() => {
        let name = ClientMediator.sendCommand("BattleMap", "GetName", { contextId: bmId });
        ClientMediator.register({ id: `${id}`, panel: "BattleMapNameContextHook", onEvent: (e) => {
            if (e.event === "BattleMapNameChanged" && e.data.contextId === bmId) {
                setBattleMapName(e.data.name);
            }
        }});
        setBattleMapName(name);
    }, [bmId]);

    return battleMapName;
}

export default useBMName;