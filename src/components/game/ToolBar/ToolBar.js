import { HStack } from '@chakra-ui/react';
import * as React from 'react';

const ToolbarStyle = {
    'backgroundColor': 'black',
    'minWidth': '100vh',
    'alignItems': 'left',
    'justifyContent': 'left',
    'padding': '2px',
}

export const ToolBar = ({ children }) => {
    return (
        <HStack margin={'10px'} style={ToolbarStyle}>
            {children}
        </HStack>
    )
}
export default ToolBar;