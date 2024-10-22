import { Flex } from '@chakra-ui/react';
import * as React from 'react';

export const BasePanel = ({ children }) => {

    return (
        <Flex
            direction="column"
            width="100%"
            height="100%"
            overflowY="auto">
            {children}
        </Flex>
    );
}
export default BasePanel;