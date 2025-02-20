import React from "react";
import Subscribable from "../base/Subscribable";
import { Button, Card, CardBody, Flex, Text } from "@chakra-ui/react";
import DListItemsButtonContainer from "../base/List/DListItemsButtonContainer";

export const RefreshInfo = ({ commandPrefix, onRefresh, ignoreRefresh }) => {
    const [show, setShow] = React.useState(false);
    return (
        <>
            <Subscribable commandPrefix={commandPrefix} onMessage={() => { if(!ignoreRefresh) setShow(true) }} />
            {show ? <Card.Root colorPalette='success'>
                <Card.Body>
                    <Flex><Text>New items are available.</Text> <DListItemsButtonContainer><Button onClick={() => { setShow(false); onRefresh(); }}>Refresh</Button></DListItemsButtonContainer></Flex>
                </Card.Body>
            </Card.Root> : <></>}
        </>);
}

export default RefreshInfo;