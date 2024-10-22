import { Icon, IconButton, Tooltip } from '@chakra-ui/react';
import * as React from 'react';
import { FaCog, FaPlus } from 'react-icons/fa';

export const AdminIconButton = (props) => {
    const { permission, top,left, onClick, icon, margin, hidden } = props;
    let setMargin = margin ? margin : '2px';
    return (
        <IconButton
            {...props}
            visibility={hidden ? 'hidden' : 'visible'}
            position={'relative'}
            top={top}
            left={left}
            margin={setMargin}
            onClick={onClick}
            colorScheme='alpha'
            variant={'solid'}
            color={props.color || 'white'}
            size={'xs'}
            icon={<Icon as={icon || FaCog} />}
            />
    );
}
export default AdminIconButton;