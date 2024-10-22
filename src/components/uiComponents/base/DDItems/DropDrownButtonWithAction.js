import { Box, Button, Center, Grid, GridItem, HStack, Icon, Menu, Stack, Td } from '@chakra-ui/react';
import * as React from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import { IoIosArrowDropdown, IoIosArrowDropright, IoMdArrowDown, IoMdArrowDropdown } from 'react-icons/io';
import DropDownButton from './DropDrownButton';
import WebSocketManagerInstance from '../../../game/WebSocketManager';

export const DropDownButtonWithAction = ({ name, icon, dropdown, width, height, actionName }) => {

    const onClick = () => {
        WebSocketManagerInstance.send({command: 'execute_action', data:actionName});
    }

    return (
        <DropDownButton name={name} icon={icon} dropdown={dropdown} width={width} height={height} onClick={onClick} />
    );
}
export default DropDownButtonWithAction;