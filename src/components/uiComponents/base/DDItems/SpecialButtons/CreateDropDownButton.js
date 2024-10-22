import { Box, Button, HStack, Icon, IconButton, Stack, Tr } from '@chakra-ui/react';
import * as React from 'react';
import DockableHelper from '../../../../../helpers/DockableHelper';
import DropDownButton from '../DropDrownButton';

export const CreateDropDownButton = ({ name, onClick, icon, width, state, element, getElementFunc }) => {
    return (
            <DropDownButton width={width} icon={icon} onClick={() =>{
                if (getElementFunc) {
                    element = getElementFunc();
                }
                DockableHelper.NewFloating(state, element);
            }} name={name} />
    );
}
export default CreateDropDownButton;