import { Box, Button, Center, Grid, GridItem, HStack, Icon, Menu, Stack } from '@chakra-ui/react';
import * as React from 'react';
import { FaArrowLeft } from '@react-icons/all-files/fa/FaArrowLeft';
import { IoIosArrowDropdown } from '@react-icons/all-files/io/IoIosArrowDropdown';
import { IoIosArrowDropright } from '@react-icons/all-files/io/IoIosArrowDropright';
import { IoMdArrowDown } from '@react-icons/all-files/io/IoMdArrowDown';
import { IoMdArrowDropdown } from '@react-icons/all-files/io/IoMdArrowDropdown';
import DropDownButton from './DropDrownButton';
import ClientMediator from '../../../../ClientMediator';

export const DropDownButtonWithAction = ({ name, icon, dropdown, width, height, actionName }) => {

    const onClick = () => {
        ClientMediator.sendCommand("Action", "Run", { name: actionName });
    }

    return (
        <DropDownButton name={name} icon={icon} dropdown={dropdown} width={width} height={height} onClick={onClick} />
    );
}
export default DropDownButtonWithAction;