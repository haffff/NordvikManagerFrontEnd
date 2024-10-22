import * as React from 'react';
import GameList from './gameLobby/GameList';
import { Game } from './game/Game';
import WebHelper from '../helpers/WebHelper';
import FabricTypesInitialize from './FabricTypesInitializer';
import WebSocketManagerInstance from './game/WebSocketManager';


export const MainApp = () => {

    const [gameID, setGameID] = React.useState();

    FabricTypesInitialize();

    if(gameID === undefined)
    {
        return (<GameList OnSuccess={setGameID} OnLogout={ () => WebHelper.getNoResp("user/logout",()=>{})} />);
    }

    const onExit = () => {
        if(WebSocketManagerInstance.WebSocketReady)
        {
            WebSocketManagerInstance.Close();
        }
        setGameID(undefined);
    }

    return (<Game onExit={onExit} gameID={gameID} />);
}
export default MainApp;