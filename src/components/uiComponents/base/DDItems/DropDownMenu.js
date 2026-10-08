import { Button } from "@chakra-ui/react";
import * as React from "react";
import { IoIosArrowDropdown } from "react-icons/io";
import DropDownButton from "./DropDrownButton";
import ClientMediator from "../../../../ClientMediator";
import { usePermissions } from "../../../../contexts/PermissionsContext";
import {
  MenuContent,
  MenuTrigger,
  MenuContextTrigger,
  MenuItem,
  MenuTriggerItem,
  MenuRoot,
} from "../../../ui/menu";
import { FaAngleDown, FaArrowDown } from "react-icons/fa";
import {
  addMenuItem,
  addSubMenu,
  getMenuItems,
  resetMenuItems,
  subscribeMenuItems,
} from "./menuItemsStore";

const NO_ITEMS = Object.freeze([]);

// Not scoped to a game/session on its own — MainApp remounts <Game key={gameID}>
// on every game switch, but the item store survives that remount untouched. Without
// clearing it on exit, an addon-added menu item from Game A (e.g. one that calls
// into commands/panels that don't exist for Game B) would silently reappear when
// the user leaves and joins a different Game B. Call this from MainApp.handleExit.
export function resetPersistedMenuItems() {
  resetMenuItems();
}

export const DropDownMenu = ({
  children,
  name,
  submenu,
  width,
  icon,
  onDropDown,
  gmOnly,
  adminOnly,
  viewId,
}) => {
  const { isGM, isAdmin } = usePermissions();
  const additionalItems = React.useSyncExternalStore(
    subscribeMenuItems,
    () => (viewId ? getMenuItems(viewId) : NO_ITEMS)
  );

  // Kept for addons and actions that send "DropDownMenu" commands through the
  // ClientMediator; the items go to the store either way.
  React.useEffect(() => {
    if (!viewId) return;
    ClientMediator.register({
      panel: "DropDownMenu",
      id: viewId,
      contextId: viewId,
      AddMenuItem: (data) => {
        const element = (data && data.item !== undefined) ? data.item : data;
        addMenuItem(viewId, element);
      },
      AddSubMenu: ({ subMenuId, subMenuName }) => addSubMenu(viewId, subMenuId, subMenuName),
    });
    ClientMediator.fireEvent("DropDownMenuReady", { viewId });
    // Deliberately left registered on unmount: it only writes to the store, so
    // items sent while this menu is closed are still there when it mounts again.
  }, [viewId]);

  if (gmOnly && !isGM) return null;
  if (adminOnly && !isAdmin) return null;

  return (
    <MenuRoot lazyMount={false} closeOnSelect  >
      {submenu ? <MenuTriggerItem>{icon} {name} </MenuTriggerItem> : <MenuTrigger asChild>
        <Button height={'30px'} textAlign={'left'} justifyContent={'start'} size={'xs'} borderRadius={0} variant="outline">
          <FaAngleDown /> {name}
        </Button>
      </MenuTrigger>}
      <MenuContent>
        {children}
        {additionalItems.map((item) => item?.subMenu
          ? <DropDownMenu key={item.key} viewId={item.subMenu.viewId} name={item.subMenu.name} submenu={true} />
          : item)}
      </MenuContent>
    </MenuRoot>
  );
};
export default DropDownMenu;

