import { HStack } from '@chakra-ui/react';
import * as React from 'react';
import themeColors from "../../../helpers/themeColors";

// Chakra props rather than an inline style, so a custom stylesheet can
// restyle it (.nm_toolbar, --nordvik-toolbar).
export const ToolBar = ({ children }) => {
    return (
        <HStack
            className="nm_toolbar"
            bg={themeColors.toolbar}
            minWidth="100vh"
            // Valid values only: as a Chakra prop an invalid one (e.g. "left") replaces
            // HStack's default centring and the browser then drops it, pushing the buttons down.
            alignItems="center"
            justifyContent="flex-start"
            padding="2px"
        >
            {children}
        </HStack>
    )
}
export default ToolBar;