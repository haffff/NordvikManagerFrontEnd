import { Button, Flex } from '@chakra-ui/react';
import * as React from 'react';
import '../../../stylesheets/panel.css';
import DockableHelper from '../../../helpers/DockableHelper';
import { useDockable } from '@hlorenzi/react-dockable';

export const BasePanel = (props) => {
    const {children, baseRef} = props;

    return (
        <Flex ref={baseRef} {...props}
        className='nm_basePanel'>
            {children}
        </Flex>
    );
}
export default BasePanel;