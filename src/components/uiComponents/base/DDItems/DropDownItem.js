import { Box, Button, HStack, Icon, IconButton, Stack, Tr } from '@chakra-ui/react';
import * as React from 'react';
import DropDownButton from './DropDrownButton';

export const DropDownItem = ({ name, onClick, icon, width, gmOnly }) => {

    if(gmOnly && localStorage.getItem("gmMode") !== "true")
    {
        return null;
    }

    return (
        <div>
            <DropDownButton width={width} icon={icon} onClick={() => onClick()} name={name} />
        </div>
    )
}
export default DropDownItem;