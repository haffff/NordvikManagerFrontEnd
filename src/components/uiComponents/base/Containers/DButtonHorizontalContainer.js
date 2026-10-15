import { Button, Center, Flex, HStack, Icon, Stack } from '@chakra-ui/react';
import * as React from 'react';
import { FaPlus } from '@react-icons/all-files/fa/FaPlus';

export const DButtonHorizontalContainer = ({children}) => {
    
    return (
        <HStack padding={'10px'} spacing={'15px'}>
            {children}
        </HStack>
    );
}
export default DButtonHorizontalContainer;