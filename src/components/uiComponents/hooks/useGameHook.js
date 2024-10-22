import React from "react";
import ClientMediator from "../../../ClientMediator";
import useUUID from "./useUUID";

export const useGame = () => {
    const [game, setGame] = React.useState(undefined);
    const uuid = useUUID();

    React.useEffect(() => {
        ClientMediator.sendCommandAsync("Game", "GetGame", { uniqueKey: uuid }, true).then(x => {
            setGame(x);
        });
    }, []);

    return game;
}

export default useGame;