import { Button, Center, Flex, Icon, IconButton, Stack, Tooltip } from '@chakra-ui/react';
import * as React from 'react';
import { FaPlus } from 'react-icons/fa';

export const DListItemButton = ({ style, label, size, bgColor, onClick, color, icon, margin, variant, hidden }) => {

    let setMargin = margin ? margin : '2px';
    return (
        <Tooltip openDelay={300} label={label} fontSize='md'>
            <IconButton
                visibility={hidden ? 'hidden' : 'visible'}
                backgroundColor={bgColor}
                margin={setMargin}
                onClick={onClick}
                style={style}
                colorScheme='alpha'
                variant={variant}
                color={color || 'white'}
                size={size}
                icon={<Icon as={icon} />} />
        </Tooltip>
    );
}
export default DListItemButton;