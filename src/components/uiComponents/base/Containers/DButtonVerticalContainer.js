import { Stack } from '@chakra-ui/react';
import * as React from 'react';

export const DButtonVerticalContainer = ({children}) => {
    
    return (
        <Stack padding={'10px'} spacing={'15px'}>
            {children}
        </Stack>
    );
}
export default DButtonVerticalContainer;