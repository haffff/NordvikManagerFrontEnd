import { HStack } from '@chakra-ui/react';
import * as React from 'react';

const ToolbarStyle = {
    'backgroundColor': 'black',
    'minWidth': '100vh',
    'alignItems': 'left',
    'justifyContent': 'left',
}

export const ToolBar = ({ children }) => {
    return (
        <HStack style={ToolbarStyle}>
            {children}
        </HStack>
    )
}
export default ToolBar;