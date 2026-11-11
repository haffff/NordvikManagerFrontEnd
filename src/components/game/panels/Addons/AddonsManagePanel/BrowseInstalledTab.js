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
import { FaArrowUp } from "@react-icons/all-files/fa/FaArrowUp";
import { FaTrash } from "@react-icons/all-files/fa/FaTrash";
import { ActiveWebHelper as WebHelper } from "../../../../../helpers/transport";
import { toaster } from "../../../../ui/toaster";
import addonOpLog from "../../../../../helpers/addonOpLog";
import ProgressToastManager from "../../../../../helpers/ProgressToastManager";
import { Switch } from "../../../../ui/switch";
import DContainer from "../../../../uiComponents/base/Containers/DContainer";
import DList from "../../../../uiComponents/base/List/DList";
import DListItem from "../../../../uiComponents/base/List/DListItem";
import DLabel from "../../../../uiComponents/base/Text/DLabel";
import { DUIBox } from "../../../../uiComponents/base/List/DUIBox";
import { safeExternalUrl } from "../../../../../helpers/safeUrl";
import AddonReadme from "./AddonReadme";

const asList = (addons) => (Array.isArray(addons) ? addons : []);

/** The installed addons that list `addon` as a dependency. */
const dependentsOf = (addons, addon) =>
  addon?.key ? asList(addons).filter((x) => x !== addon && (x.dependencies ?? []).some((d) => d?.key === addon.key)) : [];

/** A dependency by its installed name (its key when it isn't installed), with the lowest version that works. */
const dependencyLabel = (addons, dependency) => {
  const name = asList(addons).find((x) => x.key === dependency.key)?.name ?? dependency.key;
  return dependency.version ? `${name} ≥ ${dependency.version}` : name;
};

const quotedNames = (addons) => addons.map((x) => `"${x.name ?? x.key}"`).join(", ");

export const BrowseInstalledTab = ({ handleReload, addons, loading, repository }) => {
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState(null);
  const [uninstalling, setUninstalling] = useState(null);

  const filtered = useMemo(
    () => (Array.isArray(addons) ? addons : []).filter((x) => x.name?.toLowerCase().includes(search.toLowerCase())),
    [addons, search]
  );

  // selectedKey is set via addon.key ?? addon.id (below) — the lookup here must use
  // the same fallback, or an addon with an id but no key never matches and never
  // shows as selected (the uninstall/toggle handlers already use this fallback,
  // confirming such records exist).
  const currentSelected = useMemo(
    () => (selectedKey ? (Array.isArray(addons) ? addons : []).find((x) => (x.key ?? x.id) === selectedKey) ?? null : null),
    [addons, selectedKey]
  );

  const neededBy = useMemo(() => dependentsOf(addons, currentSelected), [addons, currentSelected]);

  // The registry's entry for it, for its readme (installed addons don't carry one).
  const registryEntry = useMemo(
    () => (currentSelected?.key ? (Array.isArray(repository) ? repository : []).find((x) => x.key === currentSelected.key) ?? null : null),
    [repository, currentSelected]
  );

  const uninstall = async (addon) => {
    const addonKey = addon.key ?? addon.id;
    setUninstalling(addonKey);
    try {
      addonOpLog(`uninstall "${addonKey}" (id ${addon.id}) clicked`);
      const { status, body } = await WebHelper.postAsync("addon/uninstall", { addonId: addon.id ?? addon.key });
      addonOpLog(`uninstall "${addonKey}" answered ${status}`, body);
      if (status >= 200 && status < 300 && body?.operationId) {
        const opId = body.operationId;
        ProgressToastManager.track(opId, { title: `Uninstalling "${addon.name}"…` })
          .then(() => { setSelectedKey(null); return handleReload(); }).catch(() => {});
      } else {
        // e.g. 409 when other addons still need it; the server says which.
        toaster.create({ title: "Uninstall failed", description: body?.error, type: "error", duration: 8000 });
      }
    } catch (e) {
      addonOpLog(`uninstall "${addonKey}" request failed: ${e.message}`);
      toaster.create({ title: "Uninstall failed", description: e.message, type: "error", duration: 6000 });
    } finally {
      setUninstalling(null);
    }
  };

  const toggleEnabled = async (addon, enabled) => {
    await WebHelper.postAsync("addon/setEnabled", { addonId: addon.id ?? addon.key, enabled });
    // Allowed, but the addons that need it may stop working.
    const needing = dependentsOf(addons, addon);
    if (!enabled && needing.length > 0) {
      toaster.create({
        title: `"${addon.name ?? addon.key}" is off`,
        description: `${quotedNames(needing)} ${needing.length === 1 ? "needs" : "need"} it and may not work until it's back on.`,
        type: "warning",
        duration: 8000,
      });
    }
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
              {safeExternalUrl(currentSelected.website) && (
                <Flex gap="8px">
                  <Text opacity={0.5} minWidth="90px">Website</Text>
                  <a href={safeExternalUrl(currentSelected.website)} target="_blank" rel="noopener noreferrer">
                    <Text color="blue.300" textDecoration="underline">{currentSelected.website}</Text>
                  </a>
                </Flex>
              )}
              {currentSelected.dependencies?.length > 0 && (
                <Flex gap="8px" align="flex-start">
                  <Text opacity={0.5} minWidth="90px">Dependencies</Text>
                  <Flex gap="4px" flexWrap="wrap">
                    {currentSelected.dependencies.map((dep) => (
                      <Badge key={dep.key} size="sm" variant="subtle">{dependencyLabel(addons, dep)}</Badge>
                    ))}
                  </Flex>
                </Flex>
              )}
              {neededBy.length > 0 && (
                <Flex gap="8px" align="flex-start">
                  <Text opacity={0.5} minWidth="90px">Needed by</Text>
                  <Flex gap="4px" flexWrap="wrap">
                    {neededBy.map((x) => (
                      <Badge key={x.key ?? x.id} size="sm" variant="subtle">{x.name ?? x.key}</Badge>
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
              loading={uninstalling === (currentSelected.key ?? currentSelected.id)}
              onClick={() => uninstall(currentSelected)}
            >
              <FaTrash /> Uninstall
            </Button>
          </HStack>

          {registryEntry?.readme && (
            <>
              <Separator />
              <AddonReadme addon={registryEntry} />
            </>
          )}
        </Flex>
      ) : (
        <Flex flex={1} align="center" justify="center" opacity={0.4} fontSize="sm">
          Select an addon to view details
        </Flex>
      )}
    </Flex>
  );
};
