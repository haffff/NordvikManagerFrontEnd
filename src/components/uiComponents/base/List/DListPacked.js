import { Button, Center, Flex, Icon, Stack } from '@chakra-ui/react';
import * as React from 'react';
import { FaPlus } from 'react-icons/fa';

export const DListPacked = ({mainComponent, withAddButton, handleAdd, items, itemTemplate}) => {
    return (
        <Flex 
        direction="column"
        width={mainComponent ? "100%" : undefined} 
        overflowY={mainComponent ? "auto" : undefined}>
            {items?.map((i) => itemTemplate(i))}
            {withAddButton ? 
            (<Button onClick={handleAdd} padding={3} margin={1} size='sm' width="97%">
                <Center><Icon as={FaPlus} /></Center>
            </Button>) : 
            undefined}
        </Flex>
    );
}
export default DListPacked;