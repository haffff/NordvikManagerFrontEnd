import React, { useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Input,
  Separator,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { FaArrowUp, FaTrash } from "react-icons/fa";
import { ActiveWebHelper as WebHelper } from "../../../../../helpers/transport";
import { toaster } from "../../../../ui/toaster";
import { Switch } from "../../../../ui/switch";
import DContainer from "../../../../uiComponents/base/Containers/DContainer";
import DList from "../../../../uiComponents/base/List/DList";
import DListItem from "../../../../uiComponents/base/List/DListItem";
import DLabel from "../../../../uiComponents/base/Text/DLabel";
import { DUIBox } from "../../../../uiComponents/base/List/DUIBox";

export const BrowseInstalledTab = ({ handleReload, addons, loading }) => {
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState(null);

  const filtered = useMemo(
    () => (Array.isArray(addons) ? addons : []).filter((x) => x.name?.toLowerCase().includes(search.toLowerCase())),
    [addons, search]
  );

  const currentSelected = useMemo(
    () => (selectedKey ? (Array.isArray(addons) ? addons : []).find((x) => x.key === selectedKey) ?? null : null),
    [addons, selectedKey]
  );

  const uninstall = async (addon) => {
    const result = await WebHelper.postAsync("addon/uninstall", { addonId: addon.id ?? addon.key });
    if (result?.status >= 200 && result?.status < 300) {
      toaster.create({ title: `"${addon.name}" uninstalled`, type: "success", duration: 4000 });
      setSelectedKey(null);
      await handleReload();
    } else {
      toaster.create({ title: "Uninstall failed", type: "error", duration: 6000 });
    }
  };

  const toggleEnabled = async (addon, enabled) => {
    await WebHelper.postAsync("addon/setEnabled", { addonId: addon.id ?? addon.key, enabled });
    await handleReload();
  };

  const update = async (addon) => {
    const result = await WebHelper.postAsync("addon/update", { key: addon.key });
    if (result?.status >= 200 && result?.status < 300) {
      toaster.create({ title: `"${addon.name}" updated`, type: "success", duration: 4000 });
      await handleReload();
    } else {
      toaster.create({ title: "Update failed", type: "error", duration: 6000 });
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
    <Flex direction="row" height="100%" overflow="hidden">
      <DContainer title="Installed" width="220px">
        <Input
          placeholder="Search..."
          size="sm"
          marginBottom="6px"
          onChange={(e) => setSearch(e.target.value)}
        />
        <DList>
          {filtered.length === 0 ? (
            <Box padding="10px" opacity={0.5} fontSize="sm">
              No addons installed
            </Box>
          ) : (
            filtered.map((addon) => (
              <DListItem
                key={addon.key ?? addon.id}
                onClick={() => setSelectedKey(addon.key ?? addon.id)}
                isSelected={currentSelected?.key === (addon.key ?? addon.id)}
                withHover
              >
                <Flex direction="column" gap="2px" flex={1}>
                  <DLabel>{addon.name}</DLabel>
                  {addon.version && (
                    <Text fontSize="xs" opacity={0.5}>v{addon.version}</Text>
                  )}
                </Flex>
                {addon.isEnabled === false && (
                  <Badge size="sm" colorPalette="gray" variant="subtle">Off</Badge>
                )}
              </DListItem>
            ))
          )}
        </DList>
      </DContainer>

      {currentSelected ? (
        <Flex flex={1} direction="column" padding="12px" gap="10px" overflow="auto">
          <DUIBox>
            <Flex align="center" justify="space-between" flexWrap="wrap" gap="6px">
              <Heading size="sm">{currentSelected.name}</Heading>
              {currentSelected.version && (
                <Badge variant="outline" colorPalette="gray">v{currentSelected.version}</Badge>
              )}
            </Flex>

            {currentSelected.description && (
              <Text fontSize="sm" opacity={0.8}>{currentSelected.description}</Text>
            )}

            <Separator />

            <Flex direction="column" gap="6px" fontSize="sm">
              {currentSelected.author && (
                <Flex gap="8px">
                  <Text opacity={0.5} minWidth="90px">Author</Text>
                  <Text>{currentSelected.author}</Text>
                </Flex>
              )}
              {currentSelected.license && (
                <Flex gap="8px">
                  <Text opacity={0.5} minWidth="90px">License</Text>
                  <Text>{currentSelected.license}</Text>
                </Flex>
              )}
              {currentSelected.website && (
                <Flex gap="8px">
                  <Text opacity={0.5} minWidth="90px">Website</Text>
                  <a href={currentSelected.website} target="_blank" rel="noreferrer">
                    <Text color="blue.300" textDecoration="underline">{currentSelected.website}</Text>
                  </a>
                </Flex>
              )}
              {currentSelected.dependencies?.length > 0 && (
                <Flex gap="8px" align="flex-start">
                  <Text opacity={0.5} minWidth="90px">Dependencies</Text>
                  <Flex gap="4px" flexWrap="wrap">
                    {currentSelected.dependencies.map((dep) => (
                      <Badge key={dep} size="sm" variant="subtle">{dep}</Badge>
                    ))}
                  </Flex>
                </Flex>
              )}
            </Flex>

            <Separator />

            <Switch
              checked={currentSelected.isEnabled !== false}
              onCheckedChange={(e) => toggleEnabled(currentSelected, e.checked)}
            >
              Enabled
            </Switch>
          </DUIBox>

          <HStack gap="8px">
            <Button size="sm" variant="outline" onClick={() => update(currentSelected)}>
              <FaArrowUp /> Update
            </Button>
            <Button
              size="sm"
              colorPalette="red"
              variant="outline"
              onClick={() => uninstall(currentSelected)}
            >
              <FaTrash /> Uninstall
            </Button>
          </HStack>
        </Flex>
      ) : (
        <Flex flex={1} align="center" justify="center" opacity={0.4} fontSize="sm">
          Select an addon to view details
        </Flex>
      )}
    </Flex>
  );
};
