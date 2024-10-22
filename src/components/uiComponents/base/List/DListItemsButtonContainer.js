import { Button, Center, Flex, Icon, Stack } from '@chakra-ui/react';
import * as React from 'react';

export const DListItemsButtonContainer = ({ children }) => {

    return (
        <Flex grow={1} direction={'row-reverse'} alignItems={'center'}  justifyItems={'center'} verticalAlign={'middle'}>
            {children}
        </Flex>
    );
}
export default DListItemsButtonContainer;