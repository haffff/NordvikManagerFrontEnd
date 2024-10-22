import React, { useMemo } from "react";
import * as icons from 'react-icons/gi';

export const DynamicIcon = ({ iconName, iconProps }) => {
    const DynIcon = useMemo(() => {
        return icons[iconName];
    }, [iconName]);

    if(DynIcon)
    {
        return (<DynIcon {...iconProps} />);
    }
    else
    {
        return <></>;
    }
}

export default DynamicIcon;