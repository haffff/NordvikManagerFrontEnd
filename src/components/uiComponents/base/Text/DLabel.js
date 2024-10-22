import { FormLabel } from '@chakra-ui/react';
import * as React from 'react';

export const DLabel = ({children}) => {
    
    return (
        <FormLabel padding={'2px'}>
            {children}
        </FormLabel>
    );
}
export default DLabel;