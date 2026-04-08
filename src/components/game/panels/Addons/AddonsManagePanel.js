import * as React from "react";
import { Flex, Tabs } from "@chakra-ui/react";
import * as Dockable from "@hlorenzi/react-dockable";
import { ActiveWebHelper as WebHelper } from "../../../../helpers/transport";
import { BasePanel } from "../../../uiComponents/base/BasePanel";
import { InstallFromFileTab } from "./AddonsManagePanel/InstallFromFileTab";
import { BrowseInstalledTab } from "./AddonsManagePanel/BrowseInstalledTab";
import { BrowseAddonsTab } from "./AddonsManagePanel/BrowseAddonsTab";

export const AddonsManagePanel = ({ state }) => {
  const [addons, setAddons] = React.useState([]);
  const [repository, setRepository] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const ctx = Dockable.useContentContext();
  ctx.setTitle("Addons");

  React.useEffect(() => {
    handleReload();
  }, []);

  const handleReload = async () => {
    setLoading(true);
    const [installed, repo] = await Promise.all([
      WebHelper.getAsync("addon/installed"),
      WebHelper.getAsync("addon/repository"),
    ]);
    setAddons(Array.isArray(installed) ? installed : []);
    setRepository(Array.isArray(repo) ? repo : []);
    setLoading(false);
  };

  return (
    <BasePanel>
      <Flex direction="column" height="100%" overflow="hidden">
        <Tabs.Root defaultValue="browse" display="flex" flexDirection="column" flex={1} overflow="hidden">
          <Tabs.List flexShrink={0}>
            <Tabs.Trigger value="browse">Browse</Tabs.Trigger>
            <Tabs.Trigger value="installed">Installed</Tabs.Trigger>
            <Tabs.Trigger value="install">Install</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="browse" flex={1} overflow="hidden" padding={0}>
            <BrowseAddonsTab
              handleReload={handleReload}
              repository={repository}
              addons={addons}
              loading={loading}
            />
          </Tabs.Content>
          <Tabs.Content value="installed" flex={1} overflow="hidden" padding={0}>
            <BrowseInstalledTab handleReload={handleReload} addons={addons} loading={loading} />
          </Tabs.Content>
          <Tabs.Content value="install" flex={1} overflow="hidden" padding={0}>
            <InstallFromFileTab handleReload={handleReload} />
          </Tabs.Content>
        </Tabs.Root>
      </Flex>
    </BasePanel>
  );
};

export default AddonsManagePanel;
