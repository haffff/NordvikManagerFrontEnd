import React from "react";
import ClientMediator from "../../../ClientMediator";
import useUUID from "./useUUID";

export const useClientMediator = (panelName, methods) => {
    const uuid = useUUID();

    React.useEffect(
        () => {
            ClientMediator.register({ id: `${panelName}-${uuid}`, panel: panelName, ...methods });
            return () => ClientMediator.unregister(`${panelName}-${uuid}`);
        },
        []
    );

    return true;
}

export default useClientMediator;