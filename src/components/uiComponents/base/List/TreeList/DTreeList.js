import { Button, Center, Flex, Icon, Stack } from '@chakra-ui/react';
import * as React from 'react';
import { FaPlus } from 'react-icons/fa';

export const DTreeList = ({mainComponent, withAddButton, handleAdd, items}) => {
    
    items = items || [];

    const splittedPathItems = items.map((item) => {
        return {...item, path: item.path.split("/")};
    });

    return (
        <Flex 
        direction="column" 
        width={mainComponent ? "100%" : undefined} 
        overflowY={mainComponent ? "auto" : undefined}>
        </Flex>
    );
}
export default DTreeList;