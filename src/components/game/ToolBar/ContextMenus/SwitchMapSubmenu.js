import * as React from "react";
import { FaCheckCircle } from "@react-icons/all-files/fa/FaCheckCircle";
import { FaExchangeAlt } from "@react-icons/all-files/fa/FaExchangeAlt";
import { FaFolder } from "@react-icons/all-files/fa/FaFolder";
import { FaPlus } from "@react-icons/all-files/fa/FaPlus";
import { DropDownMenu } from "../../../uiComponents/base/DDItems/DropDownMenu";
import { DropDownItem } from "../../../uiComponents/base/DDItems/DropDownItem";
import DynamicIcon from "../../../uiComponents/icons/DynamicIcon";
import { ActiveTransportManager as WebSocketManagerInstance } from "../../../../helpers/transport";
import CommandFactory from "../../../BattleMap/Factories/CommandFactory";
import { mapMenuNodes, useMapTree } from "./useMapTree";

/**
 * Reusable "Switch Map" submenu. Maps are grouped in the Map Selector's folders.
 *
 * Props:
 *   maps         – array of map objects { id, name }
 *   battleMapId  – the BattleMap context ID (used for the map_change command)
 *   currentMapId – id of the currently loaded map (shows check icon)
 *   width        – item width (default 150)
 *   showAddMap   – whether to show "Add Map" at the bottom (default true)
 */
export const SwitchMapSubmenu = ({ maps, battleMapId, currentMapId, width = 150, showAddMap = true }) => {
  const entries = useMapTree();
  const nodes = React.useMemo(() => mapMenuNodes(entries, maps), [entries, maps]);

  if (!maps || maps.length === 0) return null;

  const renderNode = (n) => n.isFolder ? (
    <DropDownMenu
      key={n.id}
      submenu={true}
      width={width}
      name={n.name}
      icon={n.entry?.icon ? <DynamicIcon iconName={n.entry.icon} /> : <FaFolder style={n.entry?.color ? { color: n.entry.color } : undefined} />}
    >
      {n.children.map(renderNode)}
    </DropDownMenu>
  ) : (
    <DropDownItem
      key={n.entity.id}
      uid={n.entity.id}
      width={width}
      name={n.name}
      icon={n.entity.id === currentMapId ? <FaCheckCircle style={{ color: 'var(--chakra-colors-green-400)' }} /> : undefined}
      onClick={() => WebSocketManagerInstance.Send(CommandFactory.CreateChangeMapCommand(n.entity.id, battleMapId))}
    />
  );

  return (
    <DropDownMenu submenu={true} width={width} name={"Switch Map"} icon={<FaExchangeAlt />}>
      {nodes.map(renderNode)}
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
