import { AbsoluteCenter, Box, Separator } from '@chakra-ui/react';
import * as React from 'react';

export const DropDownSeparator = ({ title }) => {
    return (
        <div>
            <Box position='relative'>
                <Separator marginTop="3" marginBottom="2" />
                <AbsoluteCenter color="var(--nordvik-text-color)" px='1'>
                    <Box style={{fontSize:11}}>{title}</Box>
                </AbsoluteCenter>
            </Box>
        </div>
    )
}
export default DropDownSeparator;