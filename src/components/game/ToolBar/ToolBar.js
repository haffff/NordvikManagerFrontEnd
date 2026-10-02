import { HStack } from '@chakra-ui/react';
import * as React from 'react';
import themeColors from "../../../helpers/themeColors";

// Chakra props rather than an inline style, so a custom stylesheet can
// restyle it (.nm_toolbar, --nordvik-toolbar).
export const ToolBar = ({ children }) => {
    return (
        <HStack
            className="nm_toolbar"
            margin={'10px'}
            bg={themeColors.toolbar}
            minWidth="100vh"
            alignItems="left"
            justifyContent="left"
            padding="2px"
        >
            {children}
        </HStack>
    )
}
export default ToolBar;