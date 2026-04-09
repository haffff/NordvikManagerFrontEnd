import * as React from 'react';
import { usePermissions } from '../../../contexts/PermissionsContext';

export const OnlyOwner = ({ children }) => {
    const { isGM } = usePermissions();
    return isGM ? children : <></>;
}

export default OnlyOwner;