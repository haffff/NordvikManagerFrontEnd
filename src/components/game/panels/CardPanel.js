import * as React from 'react';
import BasePanel from '../../uiComponents/base/BasePanel';
import * as Dockable from "@hlorenzi/react-dockable";
import WebHelper from '../../../helpers/WebHelper';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@chakra-ui/react';
import ClientMediator from '../../../ClientMediator';
import useGame from '../../uiComponents/hooks/useGameHook';

class PureIframe extends React.PureComponent {
    render() {
        const { gameId, id, cardadr } = this.props;
        return (
            <iframe height={'100%'} width={'100%'} sandbox="allow-same-origin allow-scripts" allow='' src={`${WebHelper.CardAddress}?gameId=${gameId}&cardId=${id}`}></iframe>
        );
    }
}

export const CardPanel = ({ gameDataManagerRef, state, id, name }) => {
    const game = useGame();

    const ctx = Dockable.useContentContext();
    ctx.setTitle(name);

    if(!game)
    {
        return <>Loading</>;
    }

    return (
        <>
            <PureIframe gameId={game.id} id={id} cardadr={WebHelper.CardAddress} />
            <div style={{ display: 'none', width: '100%', height: '100%', top: 0, left: 0, position: 'absolute' }}></div>
        </>
    )
}
export default CardPanel;