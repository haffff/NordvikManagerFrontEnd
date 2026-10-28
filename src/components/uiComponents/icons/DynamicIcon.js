import React, { useState, useEffect } from "react";
import { ICON_PACK_LOADERS } from "../../../helpers/ReactIconPackLoaders";

export const DynamicIcon = ({ iconName, iconPack = "gi", iconProps }) => {
    const [DynIcon, setDynIcon] = useState(null);

    useEffect(() => {
        // Through the static table: Vite can't bundle import(`react-icons/${iconPack}`),
        // so that failed in the browser and the icon never showed.
        const loader = ICON_PACK_LOADERS[iconPack];
        if (!iconName || !loader) { setDynIcon(null); return; }
        let cancelled = false;
        loader()
            .then((mod) => { if (!cancelled) setDynIcon(() => mod[iconName] ?? null); })
            .catch(() => { if (!cancelled) setDynIcon(null); });
        return () => { cancelled = true; };
    }, [iconName, iconPack]);

    if (!DynIcon) return <></>;
    return <DynIcon {...iconProps} />;
};

export default DynamicIcon;