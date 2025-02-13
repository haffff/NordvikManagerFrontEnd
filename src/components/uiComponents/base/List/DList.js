import { Button, Center, Flex, Icon, Stack } from '@chakra-ui/react';
import * as React from 'react';
import { FaPlus } from 'react-icons/fa';

export const DList = (props) => {
    const {mainComponent, withAddButton, withSearch, handleAdd, children} = props;
    return (
        <Stack 
        {...props}
        width={mainComponent ? "100%" : undefined} 
        overflowY={mainComponent ? "auto" : undefined}>
            {children}
            {withAddButton ? 
            (<Button variant={'outline'} onClick={handleAdd} padding={3} margin={1} size='sm' width="97%">
                <Center><Icon as={FaPlus} /></Center>
            </Button>) : 
            undefined}
        </Stack>
    );
}
export default DList;