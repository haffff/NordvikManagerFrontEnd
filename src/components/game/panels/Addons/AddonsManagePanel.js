import * as React from "react";
import {
  TabPanels,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Box,
  Input,
  Button,
  Checkbox,
  Flex,
  HStack,
  FormLabel,
  Stack,
} from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import WebHelper from "../../../../helpers/WebHelper";
import BasePanel from "../../../uiComponents/base/BasePanel";
import DContainer from "../../../uiComponents/base/Containers/DContainer";
import DListItem from "../../../uiComponents/base/List/DListItem";
import DListItemsButtonContainer from "../../../uiComponents/base/List/DListItemsButtonContainer";
import DListItemButton from "../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import { FaArrowUp, FaDownload, FaDumpster, FaMinus } from "react-icons/fa";
import DLabel from "../../../uiComponents/base/Text/DLabel";
import UtilityHelper from "../../../../helpers/UtilityHelper";
import DList from "../../../uiComponents/base/List/DList";
import { DUIBox } from "../../../uiComponents/base/List/DUIBox";
import { InstallFromFileTab } from "./AddonsManagePanel/InstallFromFileTab";
import { BrowseInstalledTab } from "./AddonsManagePanel/BrowseInstalledTab";
import { BrowseAddonsTab } from "./AddonsManagePanel/BrowseAddonsTab";

export const AddonsManagePanel = ({ state }) => {
  const [addons, setAddons] = React.useState([]);
  const [toDownload, setToDownload] = React.useState([]);

  React.useEffect(() => {
    HandleReload();
  }, []);

  const HandleReload = async () => {
    var result = await WebHelper.getAsync("addon/addons");
    setAddons(result);

    var toDownload = await WebHelper.getAsync("addon/AddonsToDowload");
    setToDownload(toDownload);
  };

  const ctx = Dockable.useContentContext();
  ctx.setTitle(`Addons Manage Panel`);

  return (
    <BasePanel>
      <Tabs.Root defaultValue={'browse'}>
        <Tabs.List>
          <Tabs.Trigger value="browse">Browse</Tabs.Trigger>
          <Tabs.Trigger value="installed">Installed</Tabs.Trigger>
          <Tabs.Trigger value="install">Install</Tabs.Trigger>
          {/* <Tab>Create</Tab> */}
        </Tabs.List>
        <Tabs.Content value="installed">
          <BrowseInstalledTab handleReload={HandleReload} addons={addons} />
        </Tabs.Content>
        <Tabs.Content value="install">
          <InstallFromFileTab handleReload={HandleReload} />
        </Tabs.Content>
        <Tabs.Content value="browse">
          <BrowseAddonsTab
            handleReload={HandleReload}
            toDownload={toDownload}
            addons={addons}
          />
        </Tabs.Content>
      </Tabs.Root>
    </BasePanel>
  );
};
export default AddonsManagePanel;
