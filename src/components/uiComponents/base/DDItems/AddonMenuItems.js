import * as React from "react";
import { MenuSeparator } from "../../../ui/menu";
import DropDownMenu from "./DropDownMenu";
import { getMenuItems, subscribeMenuItems } from "./menuItemsStore";

const NO_ITEMS = Object.freeze([]);

// Items addons added (Add Menu Item steps) to a menu location that has no DropDownMenu
// of its own — e.g. the map's right-click menu for a token — shown inline, after a
// separator. Submenus render the way DropDownMenu renders its extra items.
export const AddonMenuItems = ({ viewId }) => {
  const items = React.useSyncExternalStore(
    subscribeMenuItems,
    () => (viewId ? getMenuItems(viewId) : NO_ITEMS)
  );

  if (items.length === 0) return null;

  return (
    <>
      <MenuSeparator />
      {items.map((item) =>
        item?.subMenu
          ? <DropDownMenu key={item.key} viewId={item.subMenu.viewId} name={item.subMenu.name} submenu={true} />
          : item
      )}
    </>
  );
};

export default AddonMenuItems;
