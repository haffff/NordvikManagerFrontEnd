import * as React from 'react';
import { Flex, FormLabel, HStack, Input } from '@chakra-ui/react'
import * as Dockable from "@hlorenzi/react-dockable"
import Subscribable from '../../../uiComponents/base/Subscribable';
import DList from '../../../uiComponents/base/List/DList';
import DContainer from '../../../uiComponents/base/Containers/DContainer';
import DListItem from '../../../uiComponents/base/List/DListItem';
import DText from '../../../uiComponents/base/Text/DText';
import DListItemButton from '../../../uiComponents/base/List/ListItemDetails/DListItemButton';
import { FaBroom, FaEye, FaPlay, FaPlayCircle, FaStop } from 'react-icons/fa';
import DockableHelper from '../../../../helpers/DockableHelper';
import LookupPanel from './LookupPanel';
import WebSocketManagerInstance from '../../WebSocketManager';
import DListItemToggleButton from '../../../uiComponents/base/List/ListItemDetails/DListItemToggleButton';
import DButtonHorizontalContainer from '../../../uiComponents/base/Containers/DButtonHorizontalContainer';
import DListItemsButtonContainer from '../../../uiComponents/base/List/DListItemsButtonContainer';
import DLabel from '../../../uiComponents/base/Text/DLabel';

export const DebugConsolePanel = ({ state, actionName }) => {
    const forceUpdate = React.useReducer(x => x + 1, 0)[1];
    const [incomingMessages, setIncomingMessages] = React.useState([]);
    const [debugMessages, setDebugMessages] = React.useState([]);
    const [_actionName, setActionName] = React.useState(actionName);
    const [isToggled, setIsToggled] = React.useState(false);
    const [lastMessage, setLastMessage] = React.useState(undefined);

    const incomingMessagesRef = React.useRef(incomingMessages);
    const debugMessagesRef = React.useRef(debugMessages);

    React.useEffect(() => {
        WebSocketManagerInstance.Send({ command: "debug_mode_get" });
    }, []);

    const HandleIncomingMessage = (response) => {
        response.date = new Date(Date.now()).toLocaleTimeString();
        if (response.command.startsWith("debug")) {
            if (response.command.startsWith("debug_mode")) {
                setIsToggled(response.data);
            }
            else {
                debugMessagesRef.current = [...debugMessagesRef.current, response];
                setLastMessage(response);
            }
            forceUpdate();
        }
        else {

            incomingMessagesRef.current = [...incomingMessagesRef.current, response];
            forceUpdate();
        }
    }

    const showDetails = (message, name = undefined) => {
        DockableHelper.NewFloating(state, <LookupPanel name={name || message.date + " - " + message.command} content={message} />);
    }

    const ctx = Dockable.useContentContext();
    ctx.setTitle(`Debug Console`);

    const PresentVariable = (x) => {
        return (<div>{x} - {typeof lastMessage?.data?.Variables[x] == 'object' ? (<DListItemButton icon={FaEye} onClick={() => showDetails(lastMessage?.data?.Variables[x], x)} />) : (lastMessage?.data?.Variables[x])}</div>)
    };

    return (
        <>
            <Subscribable onMessage={HandleIncomingMessage} commandPrefix={""} />
            <DContainer>
                <DButtonHorizontalContainer>
                    <Input placeholder="Action name" value={_actionName} onChange={(x) => setActionName(x.target.value)} />
                    <DListItemButton label="Run Action" icon={FaPlay} onClick={() => { WebSocketManagerInstance.Send({ command: "execute_action", data: {Action: _actionName} }) }} />
                    <DListItemToggleButton selectedColor={'gold'} isToggled={isToggled} label="Debug" icon={FaPlayCircle} onClick={() => { WebSocketManagerInstance.Send({ command: "debug_mode_set", data: !isToggled }) }} />
                </DButtonHorizontalContainer>
            </DContainer>
            {isToggled ? (<DContainer>
                <DButtonHorizontalContainer>
                    <DListItemToggleButton isToggled={lastMessage} selectedColor={'gold'} color={'rgb(70,70,70)'} label="Continue" icon={FaPlay} onClick={() => {
                        if (!lastMessage) {
                            return;
                        }
                        WebSocketManagerInstance.Send({ command: "debug_action_response", InputToken: lastMessage.inputToken, Data: "continue" });
                        setLastMessage(undefined);
                    }} />
                    <DListItemButton isToggled={lastMessage} selectedColor={'gold'} color={'rgb(70,70,70)'} label="Stop Action" icon={FaStop} onClick={
                        () => {
                            if (!lastMessage) {
                                return;
                            }
                            WebSocketManagerInstance.Send({ command: "debug_action_response", InputToken: lastMessage.inputToken, Data: "stop" });
                            setLastMessage(undefined);
                        }} />
                    {lastMessage ? <DLabel>{lastMessage?.data?.Step?.Type} - {lastMessage?.data?.Message}</DLabel> : <></>}
                </DButtonHorizontalContainer>
            </DContainer>) : <></>}
            <Flex overflowY={'auto'} height={'100%'}>
                <DContainer width={'550px'} maxWidth={'700px'}>
                    <DList mainComponent={true}>
                        <Flex >
                            <FormLabel>Incoming Messages</FormLabel>
                            <DListItemsButtonContainer>
                                <DListItemButton label="Clear" icon={FaBroom} onClick={() => { incomingMessagesRef.current = []; forceUpdate(); }} />
                            </DListItemsButtonContainer>
                        </Flex>
                        {incomingMessagesRef.current.map(x => (<div>{x.date} - {x.command} <DListItemButton icon={FaEye} onClick={() => showDetails(x)} /></div>))}
                    </DList>
                </DContainer>
                <DContainer width={'550px'}>
                    <DList mainComponent={true}>
                        <Flex>
                            <FormLabel>Debug Messages</FormLabel>
                            <DListItemsButtonContainer>
                                <DListItemButton label="Clear" icon={FaBroom} onClick={() => { debugMessagesRef.current = []; forceUpdate(); }} />
                            </DListItemsButtonContainer>
                        </Flex>
                        {debugMessagesRef.current.map(x => (<div>{x?.data?.Action?.Name} - {x?.data?.Step?.Type} <DListItemButton icon={FaEye} onClick={() => showDetails(x)} /></div>))}
                    </DList>
                </DContainer>
                <DContainer width={'550px'}>
                    <DList mainComponent={true}>
                        <Flex>
                            <FormLabel>Variables</FormLabel>
                        </Flex>
                        {lastMessage?.data?.Variables ? Object.keys(lastMessage?.data?.Variables).map(x => PresentVariable(x)) : <></>}
                    </DList>
                </DContainer>
            </Flex>
        </>
    )
}
export default DebugConsolePanel;