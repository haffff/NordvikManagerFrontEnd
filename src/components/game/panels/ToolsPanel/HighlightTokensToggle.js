import React, { useState } from "react";
import { FaLightbulb } from "@react-icons/all-files/fa/FaLightbulb";
import DListItemToggleButton from "../../../uiComponents/base/List/ListItemDetails/DListItemToggleButton";

// Measuring an area (Radius, Cone, Rect): light up the tokens it covers — the ones an action's
// Find would give for the same area. On this screen only.
export const HighlightTokensToggle = ({ measure }) => {
  const [on, setOn] = useState(measure?.highlightTokens !== false);
  return (
    <DListItemToggleButton
      isToggled={on}
      selectedColor={"gold"}
      selectedBgColor={"rgba(50,50,50,0.5)"}
      onClick={() => {
        if (measure) measure.highlightTokens = !on;
        setOn(!on);
      }}
      label={"Highlight tokens"}
      icon={FaLightbulb}
    />
  );
};

export default HighlightTokensToggle;
