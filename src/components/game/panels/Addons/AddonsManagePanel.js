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
  const [categories, setCategories] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [repositoryError, setRepositoryError] = React.useState(false);

  const ctx = Dockable.useContentContext();
  ctx.setTitle("Addons");

  React.useEffect(() => {
    handleReload();
  }, []);

  // A request over WebRTC that gets no answer rejects (it times out) instead of resolving
  // undefined, so each list is loaded on its own and loading always ends — one slow or
  // failed list used to leave the whole panel spinning until the page was refreshed.
  const handleReload = async () => {
    setLoading(true);
    try {
      const [installed, repo, cats] = await Promise.allSettled([
        WebHelper.getAsync("addon/installed"),
        WebHelper.getAsync("addon/repository"),
        // Older servers have no categories list: the filter then shows category keys.
        WebHelper.getAsync("addon/categories"),
      ]);
      setCategories(cats.status === "fulfilled" && Array.isArray(cats.value) ? cats.value : []);
      if (installed.status === "fulfilled") setAddons(Array.isArray(installed.value) ? installed.value : []);
      const repoOk = repo.status === "fulfilled" && Array.isArray(repo.value);
      setRepository(repoOk ? repo.value : []);
      setRepositoryError(!repoOk);
    } finally {
      setLoading(false);
    }
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
              categories={categories}
              repositoryError={repositoryError}
              addons={addons}
              loading={loading}
            />
          </Tabs.Content>
          <Tabs.Content value="installed" flex={1} overflow="hidden" padding={0}>
            <BrowseInstalledTab handleReload={handleReload} addons={addons} loading={loading} repository={repository} />
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
