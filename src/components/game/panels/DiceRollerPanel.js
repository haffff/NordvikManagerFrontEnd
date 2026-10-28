import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import { BasePanel } from "../../uiComponents/base/BasePanel";
import DiceRoller from "../dice/DiceRoller";

// Dockable home for the click-to-roll dice builder (also available as a popover in chat).
export const DiceRollerPanel = () => {
  const ctx = Dockable.useContentContext();
  ctx.setTitle("Dice");

  return (
    <BasePanel>
      <DiceRoller />
    </BasePanel>
  );
};

export default DiceRollerPanel;
