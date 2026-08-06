import React, { useState, useEffect } from "react";

export const DynamicIcon = ({ iconName, iconPack = "gi", iconProps }) => {
    const [DynIcon, setDynIcon] = useState(null);

    useEffect(() => {
        if (!iconName || !iconPack) { setDynIcon(null); return; }
        let cancelled = false;
        import(`react-icons/${iconPack}`)
            .then((mod) => { if (!cancelled) setDynIcon(() => mod[iconName] ?? null); })
            .catch(() => { if (!cancelled) setDynIcon(null); });
        return () => { cancelled = true; };
    }, [iconName, iconPack]);

    if (!DynIcon) return <></>;
    return <DynIcon {...iconProps} />;
};

export default DynamicIcon;