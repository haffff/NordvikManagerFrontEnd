import * as React from 'react';
import ClientMediator from '../../../ClientMediator';
import useUUID from '../hooks/useUUID';

export const OnlyOwner = ({ children }) => {
    const [show, setShow] = React.useState({});
    const uid = useUUID();

    React.useEffect(() => {
        const fillOwner = async () => {
            let masterId = await ClientMediator.sendCommandWaitForRegisterAsync("Game", "GetOwner", {}, true);
            let currentPlayer = await ClientMediator.sendCommandWaitForRegisterAsync("Game", "GetCurrentPlayer", {uniqueKey: uid}, true);
            setShow(masterId === currentPlayer?.id); 
        }

        fillOwner();
    }, []);

    return show ?
        children : (<></>)
}

export default OnlyOwner;