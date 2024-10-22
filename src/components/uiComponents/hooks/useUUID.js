import React from "react";
import UtilityHelper from "../../../helpers/UtilityHelper";

export const useUUID = () => {
    const [uuid, setUuid] = React.useState(UtilityHelper.GenerateUUID());
    return uuid;
}

export default useUUID;