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

// The viewIds of the menus this one is nested in, so a runtime submenu that is
// already an ancestor (A in B in A) isn't rendered again — that would never end.
const AncestorMenus = React.createContext(NO_ITEMS);

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
  const ancestors = React.useContext(AncestorMenus);
  const path = React.useMemo(() => (viewId ? [...ancestors, viewId] : ancestors), [ancestors, viewId]);
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
        <AncestorMenus.Provider value={path}>
          {children}
          {additionalItems.map((item) => {
            if (!item?.subMenu) return item;
            if (path.includes(item.subMenu.viewId)) return null;
            return <DropDownMenu key={item.key} viewId={item.subMenu.viewId} name={item.subMenu.name} submenu={true} />;
          })}
        </AncestorMenus.Provider>
      </MenuContent>
    </MenuRoot>
  );
};
export default DropDownMenu;

