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
  const [additionalItems, setAdditionalItems] = React.useState([]);
  let ref = React.useRef();

  React.useEffect(() => {
    if (viewId) {
      ClientMediator.register({
        panel: "DropDownMenu",
        id: viewId,
        contextId: viewId,
        AddMenuItem: (data) => {
          // Support both a bare React element and { contextId, item } shape
          const element = (data && data.item !== undefined) ? data.item : data;
          setAdditionalItems(prev => [...prev, element]);
        },
        AddSubMenu: ({ subMenuId, subMenuName }) => {
          // Only add a submenu if no DropDownMenu with that viewId is already registered
          const existing = ClientMediator._resolveClients
            ? ClientMediator._resolveClients("DropDownMenu", { contextId: subMenuId })
            : null;
          if (existing && existing.length > 0) return;
          const submenuElement = React.createElement(DropDownMenu, {
            key: subMenuId,
            viewId: subMenuId,
            name: subMenuName || subMenuId,
            submenu: true,
          });
          setAdditionalItems(prev => [...prev, submenuElement]);
        },
      });
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
