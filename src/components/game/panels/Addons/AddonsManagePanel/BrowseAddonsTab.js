import React, { useState, useMemo } from "react";
import { Badge, Box, Flex, Input, Spinner, Text } from "@chakra-ui/react";
import { FaArrowUp, FaCheck, FaDownload, FaExternalLinkAlt } from "react-icons/fa";
import { ActiveWebHelper as WebHelper } from "../../../../../helpers/transport";
import { toaster } from "../../../../ui/toaster";
import ClientMediator from "../../../../../ClientMediator";
import DList from "../../../../uiComponents/base/List/DList";
import DListItem from "../../../../uiComponents/base/List/DListItem";
import DListItemButton from "../../../../uiComponents/base/List/ListItemDetails/DListItemButton";
import DListItemsButtonContainer from "../../../../uiComponents/base/List/DListItemsButtonContainer";
import DLabel from "../../../../uiComponents/base/Text/DLabel";

export const BrowseAddonsTab = ({ repository, addons, handleReload, loading }) => {
  const [search, setSearch] = useState("");
  const [installing, setInstalling] = useState(null);

  const filtered = useMemo(
    () =>
      (Array.isArray(repository) ? repository : []).filter(
        (a) =>
          a.name?.toLowerCase().includes(search.toLowerCase()) ||
          a.author?.toLowerCase().includes(search.toLowerCase())
      ),
    [repository, search]
  );

  const install = async (addon) => {
    setInstalling(addon.key);
    try {
      const result = await WebHelper.postAsync("addon/install", { key: addon.key });
      if (result?.status >= 200 && result?.status < 300) {
        toaster.create({ title: `"${addon.name}" installed`, type: "success", duration: 4000 });
        await handleReload();
      } else {
        toaster.create({ title: "Installation failed", type: "error", duration: 6000 });
        if (result?.body) {
          ClientMediator.sendCommand("Game", "CreateNewPanel", {
            type: "LookupPanel",
            props: { name: "Addon install failed", content: result.body, contentType: "object" },
          });
        }
      }
    } catch (e) {
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

  return (
    <Flex direction="column" height="100%" overflow="hidden">
      <Box padding="8px" flexShrink={0}>
        <Input
          placeholder="Search addons..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="sm"
        />
      </Box>
      <DList mainComponent>
        {filtered.length === 0 ? (
          <Box padding="20px" textAlign="center" opacity={0.5} fontSize="sm">
            {repository?.length === 0 ? "No addons available in repository" : "No addons match your search"}
          </Box>
        ) : (
          filtered.map((addon) => {
            const installed = (Array.isArray(addons) ? addons : []).find((x) => x.key === addon.key);
            const isInstalled = !!installed;
            const isUpdate = isInstalled && addon.version && installed.version !== addon.version;
            const isBusy = installing === addon.key;

            return (
              <DListItem key={addon.key} padding="10px">
                <Flex flex={1} direction="column" gap="4px">
                  <Flex align="center" gap="6px" flexWrap="wrap">
                    <DLabel>{addon.name}</DLabel>
                    {addon.version && (
                      <Badge size="sm" variant="outline" colorPalette="gray">
                        v{addon.version}
                      </Badge>
                    )}
                    {isUpdate && (
                      <Badge size="sm" colorPalette="yellow">Update available</Badge>
                    )}
                    {isInstalled && !isUpdate && (
                      <Badge size="sm" colorPalette="green">Installed</Badge>
                    )}
                  </Flex>
                  {addon.description && (
                    <Text fontSize="xs" opacity={0.7}>{addon.description}</Text>
                  )}
                  <Flex gap="10px" fontSize="xs" opacity={0.5}>
                    {addon.author && <Text>by {addon.author}</Text>}
                    {addon.license && <Text>· {addon.license}</Text>}
                  </Flex>
                </Flex>
                <DListItemsButtonContainer>
                  {addon.repositoryUrl && (
                    <DListItemButton
                      label="Open repository"
                      icon={FaExternalLinkAlt}
                      onClick={() => window.open(addon.repositoryUrl, "_blank")}
                    />
                  )}
                  {isInstalled && !isUpdate && (
                    <DListItemButton label="Installed" icon={FaCheck} onClick={() => {}} />
                  )}
                  {isUpdate && (
                    <DListItemButton
                      label={isBusy ? "Updating…" : "Update"}
                      icon={FaArrowUp}
                      onClick={() => update(addon)}
                    />
                  )}
                  {!isInstalled && (
                    <DListItemButton
                      label={isBusy ? "Installing…" : "Install"}
                      icon={FaDownload}
                      onClick={() => !isBusy && install(addon)}
                    />
                  )}
                </DListItemsButtonContainer>
              </DListItem>
            );
          })
        )}
      </DList>
    </Flex>
  );
};
