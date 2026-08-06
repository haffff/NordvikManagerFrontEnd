import * as React from "react";
import { FaCheckCircle, FaExchangeAlt, FaPlus } from "react-icons/fa";
import { DropDownMenu } from "../../../uiComponents/base/DDItems/DropDownMenu";
import { DropDownItem } from "../../../uiComponents/base/DDItems/DropDownItem";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../helpers/transport";
import CommandFactory from "../../../BattleMap/Factories/CommandFactory";

/**
 * Reusable "Switch Map" submenu.
 *
 * Props:
 *   maps         – array of map objects { id, name }
 *   battleMapId  – the BattleMap context ID (used for the map_change command)
 *   currentMapId – id of the currently loaded map (shows check icon)
 *   width        – item width (default 150)
 *   showAddMap   – whether to show "Add Map" at the bottom (default true)
 */
export const SwitchMapSubmenu = ({ maps, battleMapId, currentMapId, width = 150, showAddMap = true }) => {
  if (!maps || maps.length === 0) return null;

  return (
    <DropDownMenu submenu={true} width={width} name={"Switch Map"} icon={<FaExchangeAlt />}>
      {maps.map(m => (
        <DropDownItem
          key={m.id}
          uid={m.id}
          width={width}
          name={m.name}
          icon={m.id === currentMapId ? <FaCheckCircle style={{ color: 'var(--chakra-colors-green-400)' }} /> : undefined}
          onClick={() => WebSocketManagerInstance.Send(CommandFactory.CreateChangeMapCommand(m.id, battleMapId))}
        />
      ))}
      {showAddMap && (
        <DropDownItem
          width={width}
          name={"Add Map"}
          icon={<FaPlus />}
          onClick={() => WebSocketManagerInstance.Send(CommandFactory.CreateMapAddCommand())}
        />
      )}
    </DropDownMenu>
  );
};

export default SwitchMapSubmenu;
