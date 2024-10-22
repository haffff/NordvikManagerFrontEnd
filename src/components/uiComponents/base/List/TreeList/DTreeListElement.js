import * as React from 'react';
import AdminIconButton from '../../AdminIconButton';
import { Button, Center, Flex, Icon, Stack } from '@chakra-ui/react';
import { FaPlus, FaMinus } from 'react-icons/fa';

export const DTreeListElement = ({ handleAdd, items, index, collapsed }) => {
    const itemsLocal = items || [];

    const grouped = Object.groupBy(items, (item) => item.path[index]);

    return (
        <Flex direction="column">
            {grouped[undefined].map((item) => item.element || <></>)}
            {Object.keys(grouped)
                .filter((key) => key !== undefined)
                .map((key) => {
                    const isCollapsed = collapsed.includes(key);
                    return (
                        <Stack key={key} paddingLeft={'10px'}>
                            <Center>
                                <AdminIconButton
                                    size={'xs'}
                                    onClick={() => handleAdd(key)}
                                    icon={isCollapsed ? FaPlus : FaMinus}
                                />
                            </Center>
                            {!isCollapsed && (
                                <DTreeListElement
                                    items={grouped[key]}
                                    index={index + 1}
                                    collapsed={collapsed}
                                />
                            )}
                        </Stack>
                    );
                })}
        </Flex>
    );
};

export default DTreeListElement;