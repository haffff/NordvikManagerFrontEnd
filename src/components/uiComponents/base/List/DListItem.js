import { Card, Flex } from '@chakra-ui/react';
import * as React from 'react';

export const DListItem = ({ isSelected, backgroundColor, children, padding, margin, gap, onClick, width, id }) => {
    let usedMargin = margin !== undefined ? margin : "3px";
    let usedPadding = padding !== undefined ? padding : "3px";
    let usedGap = gap !== undefined ? gap : "15px";

    return (
        <Flex className={id ? "representsElement" : ""} id={id} representsElement={id ?'1' : undefined} minWidth={width} paddingLeft={'5px'} paddingRight={'5px'}>
            <Card onClick={onClick} style={{ backgroundColor: backgroundColor || (isSelected ? 'rgba(70,70,70,50.5)' : 'rgba(50,50,50,50.5)'), color: 'white', paddingLeft:'15px', paddingBottom:'5px', paddingTop:'5px' }} colorScheme="blackAlpha" variant="elevated" padding={usedPadding} margin={usedMargin} size='sm' width="100%">
                <Flex grow={1} gap={usedGap} alignItems={'center'} justifyItems={'center'} verticalAlign={'middle'}>
                {children}
                </Flex>
            </Card>
        </Flex>
    );
}
export default DListItem;