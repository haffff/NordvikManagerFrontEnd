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

// Module-level store so addon-added items survive component remounts.
const _persistedItems = new Map(); // viewId → React element[]

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
  const [additionalItems, setAdditionalItems] = React.useState(
    () => _persistedItems.get(viewId) ?? []
  );
  let ref = React.useRef();

  React.useEffect(() => {
    if (viewId) {
      ClientMediator.register({
        panel: "DropDownMenu",
        id: viewId,
        contextId: viewId,
        AddMenuItem: (data) => {
          const element = (data && data.item !== undefined) ? data.item : data;
          setAdditionalItems(prev => {
            const next = [...prev, element];
            _persistedItems.set(viewId, next);
            return next;
          });
        },
        AddSubMenu: ({ subMenuId, subMenuName }) => {
          // Skip if a DropDownMenu with that viewId is already rendered
          const existing = ClientMediator._resolveClients
            ? ClientMediator._resolveClients("DropDownMenu", { contextId: subMenuId })
            : null;
          if (existing && existing.length > 0) return;
          // Skip if already in the persisted list
          const current = _persistedItems.get(viewId) ?? [];
          if (current.some(el => el.key === subMenuId)) return;
          const submenuElement = React.createElement(DropDownMenu, {
            key: subMenuId,
            viewId: subMenuId,
            name: subMenuName || subMenuId,
            submenu: true,
          });
          setAdditionalItems(prev => {
            const next = [...prev, submenuElement];
            _persistedItems.set(viewId, next);
            return next;
          });
        },
      });

      // send client mediator ready event
      ClientMediator.fireEvent("DropDownMenuReady", { viewId });
    }
  }, []);

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
        {additionalItems}
      </MenuContent>
    </MenuRoot>
  );
};
export default DropDownMenu;
