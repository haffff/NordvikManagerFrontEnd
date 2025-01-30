import * as React from 'react';
import GameList from './gameLobby/GameList';
import { Game } from './game/Game';
import WebHelper from '../helpers/WebHelper';
import FabricTypesInitialize from './FabricTypesInitializer';
import WebSocketManagerInstance from './game/WebSocketManager';
import { RegisterForm } from './gameLobby/RegisterForm';

export const MainApp = () => {

    const [gameID, setGameID] = React.useState();

    FabricTypesInitialize();

    if(gameID === undefined)
    {
        return (<GameList OnSuccess={setGameID} OnLogout={ () => WebHelper.getNoResp("user/logout",()=>{
            //remove Authorization cookie
            window.location.reload();
        })} />);
    }

    const onExit = () => {
        if(WebSocketManagerInstance.WebSocketReady)
        {
            WebSocketManagerInstance.Close();
        }
        setGameID(undefined);
    }

    //Dopisać ilustratora do kosztów

    return (<Game key={gameID} onExit={onExit} gameID={gameID} />);
}
export default MainApp;