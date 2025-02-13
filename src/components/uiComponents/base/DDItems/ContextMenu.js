import { Button, Icon, Stack } from '@chakra-ui/react';
import * as React from 'react';

export const ContextMenu = ({ children, location, isOpen }) => {
    return (
        <div style={{
            display: isOpen ? 'inline' : 'none',
            position: 'fixed',
            zIndex: 999,
            margin: 0,
            left: location[0],
            top: location[1],
            backgroundColor: 'var(--nordvik-secondary-color)',
        }} >
            <Stack>
                {children}
            </Stack>
        </div>
    );
}
export default ContextMenu;