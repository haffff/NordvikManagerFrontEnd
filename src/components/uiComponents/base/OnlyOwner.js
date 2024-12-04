import * as React from 'react';
import ClientMediator from '../../../ClientMediator';
import useUUID from '../hooks/useUUID';

export const OnlyOwner = ({ children }) => {
    const [show, setShow] = React.useState({});
    const uid = useUUID();

    React.useEffect(() => {
        let game = ClientMediator.sendCommand("Game", "GetGame");
        ClientMediator.sendCommandWaitForRegister("Game", "GetCurrentPlayer", {uniqueKey: uid}, true).then((response) => { setShow(response.id === game.master?.id); });
    }, []);

    return show ?
        children : (<></>)
}

export default OnlyOwner;