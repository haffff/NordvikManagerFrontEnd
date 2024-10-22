import { AbsoluteCenter, Box,  Divider } from '@chakra-ui/react';
import * as React from 'react';

export const DropDownSeparator = ({ title }) => {
    return (
        <div>
            <Box position='relative'>
                <Divider marginTop="3" marginBottom="2" />
                <AbsoluteCenter bg="rgb(20,20,20)" px='1'>
                    <div style={{fontSize:11}}>{title}</div>
                </AbsoluteCenter>
            </Box>
        </div>
    )
}
export default DropDownSeparator;