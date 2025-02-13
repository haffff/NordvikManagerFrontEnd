import { Button } from "@chakra-ui/react";
import * as React from "react";
import { IoIosArrowDropdown } from "react-icons/io";
import DropDownButton from "./DropDrownButton";
import ClientMediator from "../../../../ClientMediator";
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
  viewId,
}) => {
  const [additionalItems, setAdditionalItems] = React.useState([]);
  let ref = React.useRef();

  React.useEffect(() => {
    if (viewId) {
      ClientMediator.register({
        panel: "DropDownMenu",
        id: viewId,
        contextId: viewId,
        AddMenuItem: (item) => {
          setAdditionalItems([...additionalItems, item]);
        },
      });
    }
  }, []);

  if (gmOnly && localStorage.getItem("gmMode") !== "true") {
    return null;
  }

  return (
    <MenuRoot lazyMount={false} closeOnSelect  >
      {submenu ? <MenuTriggerItem> {name} </MenuTriggerItem> : <MenuTrigger asChild>
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
