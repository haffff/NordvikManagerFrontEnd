import React, { useState, useMemo } from "react";
import { Badge, Box, Button, Flex, Heading, Input, NativeSelect, Separator, Spinner, Text } from "@chakra-ui/react";
import { FaArrowUp } from "@react-icons/all-files/fa/FaArrowUp";
import { FaCheck } from "@react-icons/all-files/fa/FaCheck";
import { FaDownload } from "@react-icons/all-files/fa/FaDownload";
import { ActiveWebHelper as WebHelper } from "../../../../../helpers/transport";
import { toaster } from "../../../../ui/toaster";
import ClientMediator from "../../../../../ClientMediator";
import ProgressToastManager from "../../../../../helpers/ProgressToastManager";
import addonOpLog from "../../../../../helpers/addonOpLog";
import DList from "../../../../uiComponents/base/List/DList";
import DListItem from "../../../../uiComponents/base/List/DListItem";
import DListItemButton from "../../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import DListItemsButtonContainer from "../../../../uiComponents/base/List/DListItemsButtonContainer";
import DLabel from "../../../../uiComponents/base/Text/DLabel";
import { safeExternalUrl } from "../../../../../helpers/safeUrl";
import { browseAddons, categoryName, usedCategories } from "./addonsBrowse";
import AddonReadme from "./AddonReadme";

// What the registry offers: search, category filter and sort above a list; the selected
// addon's details (and readme) beside it, below it when the panel is narrow.
export const BrowseAddonsTab = ({ repository, categories = [], repositoryError, addons, handleReload, loading }) => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("name");
  const [selectedKey, setSelectedKey] = useState(null);
  const [installing, setInstalling] = useState(null);

  const filterOptions = useMemo(() => usedCategories(repository, categories), [repository, categories]);
  const listed = useMemo(
    () => browseAddons(repository, { search, category, sort }, categories),
    [repository, search, category, sort, categories]
  );
  const selected = useMemo(
    () => (Array.isArray(repository) ? repository : []).find((a) => a.key === selectedKey) ?? null,
    [repository, selectedKey]
  );

  const statusOf = (addon) => {
    const installed = (Array.isArray(addons) ? addons : []).find((x) => x.key === addon.key);
    const isInstalled = !!installed;
    const isUpdate = isInstalled && addon.version && installed.version !== addon.version;
    return { isInstalled, isUpdate, isBusy: installing === addon.key };
  };

  const install = async (addon) => {
    setInstalling(addon.key);
    try {
      addonOpLog(`install "${addon.key}" clicked`);
      const { status, body } = await WebHelper.postAsync("addon/install", { key: addon.key });
      addonOpLog(`install "${addon.key}" answered ${status}`, body);
      if (status >= 200 && status < 300 && body?.operationId) {
        const opId = body.operationId;
        ProgressToastManager.track(opId, { title: `Installing "${addon.name}"…` })
          .then(() => handleReload()).catch(() => {});
      } else {
        toaster.create({ title: "Installation failed", type: "error", duration: 6000 });
        if (body) {
          ClientMediator.sendCommand("Game", "CreateNewPanel", {
            type: "LookupPanel",
            props: { name: "Addon install failed", content: body, contentType: "object" },
          });
        }
      }
    } catch (e) {
      addonOpLog(`install "${addon.key}" request failed: ${e.message}`);
      toaster.create({ title: "Installation failed", description: e.message, type: "error", duration: 6000 });
    } finally {
      setInstalling(null);
    }
  };

  const update = async (addon) => {
    setInstalling(addon.key);
    try {
      const result = await WebHelper.postAsync("addon/update", { key: addon.key });
      if (result?.status >= 200 && result?.status < 300) {
        toaster.create({ title: `"${addon.name}" updated`, type: "success", duration: 4000 });
        await handleReload();
      } else {
        toaster.create({ title: "Update failed", type: "error", duration: 6000 });
      }
    } catch (e) {
      toaster.create({ title: "Update failed", description: e.message, type: "error", duration: 6000 });
    } finally {
      setInstalling(null);
    }
  };

  if (loading) {
    return (
      <Flex height="100%" align="center" justify="center">
        <Spinner />
      </Flex>
    );
  }

  if (repositoryError) {
    return (
      <Flex height="100%" direction="column" align="center" justify="center" gap={3}>
        <Text>Couldn't load the addon list from the server.</Text>
        <Button size="sm" onClick={handleReload}>Retry</Button>
      </Flex>
    );
  }

  return (
    <Flex direction="column" height="100%" overflow="hidden">
      <Flex padding="8px" gap="6px" flexShrink={0} flexWrap="wrap" align="center">
        <Input
          placeholder="Search addons..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="sm"
          flex="1 1 160px"
        />
        {filterOptions.length > 0 && (
          <NativeSelect.Root size="sm" width="auto" flex="0 1 160px">
            <NativeSelect.Field aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {filterOptions.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        )}
        <NativeSelect.Root size="sm" width="auto" flex="0 1 130px">
          <NativeSelect.Field aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">Name</option>
            <option value="category">Category</option>
            <option value="author">Author</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Flex>

      <Flex flex={1} overflow="auto" flexWrap="wrap" align="stretch">
        <Box flex="1 1 260px" minWidth={0} overflowY="auto" maxHeight="100%">
          <DList mainComponent>
            {listed.length === 0 ? (
              <Box padding="20px" textAlign="center" opacity={0.5} fontSize="sm">
                {repository?.length === 0 ? "No addons available in repository" : "No addons match your search"}
              </Box>
            ) : (
              listed.map((addon) => {
                const { isInstalled, isUpdate, isBusy } = statusOf(addon);
                return (
                  <DListItem
                    key={addon.key}
                    data-testid="addon-row"
                    padding="10px"
                    withHover
                    isSelected={addon.key === selectedKey}
                    onClick={() => setSelectedKey(addon.key)}
                  >
                    <Flex flex={1} direction="column" gap="4px" minWidth={0}>
                      <Flex align="center" gap="6px" flexWrap="wrap">
                        <Box data-testid="addon-name"><DLabel>{addon.name}</DLabel></Box>
                        {addon.version && <Badge size="sm" variant="outline" colorPalette="gray">v{addon.version}</Badge>}
                        {isUpdate && <Badge size="sm" colorPalette="yellow">Update available</Badge>}
                        {isInstalled && !isUpdate && <Badge size="sm" colorPalette="green">Installed</Badge>}
                        {(addon.categories ?? []).map((c) => (
                          <Badge key={c} size="sm" variant="subtle" colorPalette="teal">{categoryName(c, categories)}</Badge>
                        ))}
                      </Flex>
                      {addon.description && <Text fontSize="xs" opacity={0.7} lineClamp={2}>{addon.description}</Text>}
                      {addon.author && <Text fontSize="xs" opacity={0.5}>by {addon.author}</Text>}
                    </Flex>
                    <DListItemsButtonContainer>
                      {isInstalled && !isUpdate && <DListItemButton label="Installed" icon={FaCheck} onClick={() => {}} />}
                      {isUpdate && <DListItemButton label={isBusy ? "Updating…" : "Update"} icon={FaArrowUp} onClick={() => update(addon)} />}
                      {!isInstalled && (
                        <DListItemButton label={isBusy ? "Installing…" : "Install"} icon={FaDownload} onClick={() => !isBusy && install(addon)} />
                      )}
                    </DListItemsButtonContainer>
                  </DListItem>
                );
              })
            )}
          </DList>
        </Box>

        {selected && (
          <AddonDetails
            addon={selected}
            categories={categories}
            status={statusOf(selected)}
            onInstall={() => install(selected)}
            onUpdate={() => update(selected)}
          />
        )}
      </Flex>
    </Flex>
  );
};

const Field = ({ label, children }) => (
  <Flex gap="8px" fontSize="sm">
    <Text opacity={0.5} minWidth="80px">{label}</Text>
    <Box>{children}</Box>
  </Flex>
);

// The selected addon: what it is, where it comes from, Install/Update, and its readme.
const AddonDetails = ({ addon, categories, status, onInstall, onUpdate }) => {
  const repositoryUrl = safeExternalUrl(addon.repositoryUrl);
  const releaseUrl = safeExternalUrl(addon.releaseUrl);
  return (
    <Box
      data-testid="addon-details"
      flex="2 1 320px"
      minWidth={0}
      overflowY="auto"
      maxHeight="100%"
      padding="12px"
      borderLeftWidth="1px"
      borderColor="var(--nordvik-border, rgb(65,65,65))"
    >
      <Flex direction="column" gap="8px">
        <Flex align="center" gap="8px" flexWrap="wrap">
          <Heading size="md">{addon.name}</Heading>
          {status.isUpdate && <Badge colorPalette="yellow">Update available</Badge>}
          {status.isInstalled && !status.isUpdate && <Badge colorPalette="green">Installed</Badge>}
        </Flex>
        {addon.version && <Field label="Version">{addon.version}</Field>}
        {addon.author && <Field label="Author">{addon.author}</Field>}
        {addon.license && <Field label="License">{addon.license}</Field>}
        {(addon.categories ?? []).length > 0 && (
          <Field label="Categories">
            <Flex gap="4px" flexWrap="wrap">
              {addon.categories.map((c) => <Badge key={c} size="sm" variant="subtle" colorPalette="teal">{categoryName(c, categories)}</Badge>)}
            </Flex>
          </Field>
        )}
        {(repositoryUrl || releaseUrl) && (
          <Flex gap="12px" fontSize="sm" flexWrap="wrap">
            {repositoryUrl && <a href={repositoryUrl} target="_blank" rel="noopener noreferrer"><Text color="blue.300" textDecoration="underline">Repository</Text></a>}
            {releaseUrl && <a href={releaseUrl} target="_blank" rel="noopener noreferrer"><Text color="blue.300" textDecoration="underline">Release download</Text></a>}
          </Flex>
        )}
        <Flex gap="8px">
          {!status.isInstalled && (
            <Button size="sm" colorPalette="teal" loading={status.isBusy} onClick={onInstall}><FaDownload /> Install</Button>
          )}
          {status.isUpdate && (
            <Button size="sm" colorPalette="yellow" loading={status.isBusy} onClick={onUpdate}><FaArrowUp /> Update</Button>
          )}
        </Flex>
        <Separator />
        <AddonReadme addon={addon} />
      </Flex>
    </Box>
  );
};
