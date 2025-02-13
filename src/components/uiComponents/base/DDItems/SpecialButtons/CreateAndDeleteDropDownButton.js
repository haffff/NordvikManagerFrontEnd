import { Box, Button, HStack, Icon, IconButton, Stack, Tr } from '@chakra-ui/react';
import * as React from 'react';
import DockableHelper from '../../../../../helpers/DockableHelper';
import DeletableDropDownButton from './DeletableDropDownButton';

export const CreateAndDeleteDropDownItem = ({ name, icon, width, state, element, onDelete }) => {
    return (
        <DeletableDropDownButton width={width} icon={icon} onClick={() => DockableHelper.NewFloating(state, element)} onDeleteClick={onDelete} name={name} />
    )
}
export default CreateAndDeleteDropDownItem;