import * as React from "react";
import DropDownButton from "./DropDrownButton";

import { MenuItem } from "../../../ui/menu";

export const DropDownItem = ({ accessKey, name, onClick, icon, width, gmOnly }) => {
  if (gmOnly && localStorage.getItem("gmMode") !== "true") {
    return null;
  }

  //TODO get access key from settings

  return (
    <MenuItem value={name} width={width} onClick={onClick}>
        {icon} {name}
    </MenuItem>
  );
};
export default DropDownItem;
