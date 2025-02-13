import { Icon, IconButton } from '@chakra-ui/react';

import * as React from 'react';
import { FaPlus } from 'react-icons/fa';
import { Tooltip } from '../../../../ui/tooltip';

export const DListItemButton = ({ style, label, size, bgColor, onClick, color, icon, margin, variant, hidden }) => {

    let setMargin = margin ? margin : '2px';
    return (
        <Tooltip openDelay={300} content={label} variant='outline' fontSize='md'>
            <IconButton
                visibility={hidden ? 'hidden' : 'visible'}
                backgroundColor={bgColor}
                margin={setMargin}
                onClick={onClick}
                style={style}
                colorScheme='alpha'
                variant={variant || 'outline'}
                color={color || 'var(--nordvik-text-color)'}
                size={size}>
                    <Icon color={color || 'var(--nordvik-text-color)'} as={icon} />
                </IconButton>
        </Tooltip>
    );
}
export default DListItemButton;