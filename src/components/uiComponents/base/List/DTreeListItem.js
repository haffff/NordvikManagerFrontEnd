import { Card, Flex } from '@chakra-ui/react';
import * as React from 'react';

export const DTreeListItem = ({ isSelected, backgroundColor, children, padding, margin, gap, onClick, width, id }) => {
    let usedMargin = margin !== undefined ? margin : "3px";
    let usedPadding = padding !== undefined ? padding : "3px";
    let usedGap = gap !== undefined ? gap : "15px";

    return (
        <Flex className={id ? "representsElement" : ""} id={id} representsElement={id ?'1' : undefined} minWidth={width} paddingLeft={'5px'} paddingRight={'5px'}>
            <Card.Root onClick={onClick} style={{ backgroundColor: backgroundColor || (isSelected ? 'var(--nordvik-selection-color)' : 'var(--nordvik-item-color)'), color: 'var(--nordvik-text-color)', paddingLeft:'15px', paddingBottom:'5px', paddingTop:'5px' }} colorScheme="blackAlpha" variant="elevated" padding={usedPadding} margin={usedMargin} size='sm' width="100%">
                <Flex grow={1} gap={usedGap} alignItems={'center'} justifyItems={'center'} verticalAlign={'middle'}>
                {children}
                </Flex>
            </Card.Root>
        </Flex>
    );
}
export default DTreeListItem;