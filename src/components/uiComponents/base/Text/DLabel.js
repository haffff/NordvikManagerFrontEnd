import { Heading } from '@chakra-ui/react';
import * as React from 'react';

export const DLabel = ({children}) => {
    
    return (
        <Heading className="nm_label" size={'xs'} padding={'2px'}>
            {children}
        </Heading>
    );
}
export default DLabel;