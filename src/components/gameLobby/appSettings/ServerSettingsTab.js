import * as React from "react";
import { Badge, Box, Button, Heading, HStack, IconButton, Input, Stack, Text, Wrap } from "@chakra-ui/react";
import { FaLock } from "@react-icons/all-files/fa/FaLock";
import { FaTimes } from "@react-icons/all-files/fa/FaTimes";

import WebHelper from "../../../helpers/WebHelper";
import { showError } from "./serverErrors";

/**
 * One list setting: entries from appsettings (locked, shown with a lock) and the ones saved
 * here, which can be added and removed. Every change saves the whole saved list at once.
 */
const ListSetting = ({ locked, entries, canEdit, placeholder, addLabel, inputLabel, onSave }) => {
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const save = async (list) => {
    setBusy(true);
    try {
      return await onSave(list);
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const value = draft.trim();
    if (!value) return;
    if (await save([...entries, value])) setDraft("");
  };

  return (
    <Stack gap={2}>
      <Wrap gap={2}>
        {locked.map((entry) => (
          <Badge key={`locked-${entry}`} size="lg" variant="subtle" title="From the server's appsettings: change it there">
            <FaLock />
            {entry}
          </Badge>
        ))}
        {entries.map((entry) => (
          <Badge key={entry} size="lg" variant="outline" colorPalette="blue">
            {entry}
            {canEdit && (
              <IconButton
                size="2xs"
                variant="ghost"
                aria-label={`Remove ${entry}`}
                title="Remove"
                disabled={busy}
                onClick={() => save(entries.filter((e) => e !== entry))}
              >
                <FaTimes />
              </IconButton>
            )}
          </Badge>
        ))}
        {locked.length === 0 && entries.length === 0 && <Text color="fg.muted">None.</Text>}
      </Wrap>
      <HStack>
        <Input
          maxW="md"
          placeholder={placeholder}
          aria-label={inputLabel}
          value={draft}
          disabled={!canEdit}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
        />
        <Button onClick={add} disabled={!canEdit || busy} aria-label={addLabel}>
          Add
        </Button>
      </HStack>
    </Stack>
  );
};

const Section = ({ title, children }) => (
  <Box as="section" aria-label={title}>
    <Stack gap={3}>
      <Heading size="md">{title}</Heading>
      {children}
    </Stack>
  </Box>
);

/**
 * Application Settings → Server. Owner settings kept in the server's server-settings.json:
 * private hosts actions may reach, hosts addon cards may load from, and the addon registry.
 * Entries from appsettings are shown locked; the rest can be changed here and apply at once.
 */
export const ServerSettingsTab = () => {
  const [settings, setSettings] = React.useState(undefined);
  const [repositoryDraft, setRepositoryDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const apply = React.useCallback((value) => {
    setSettings(value);
    setRepositoryDraft(value?.addonRegistry?.mainRepository?.saved ?? "");
  }, []);

  React.useEffect(() => {
    (async () => apply((await WebHelper.getAsync("serversettings")) ?? null))();
  }, [apply]);

  // Saves and shows what the server kept; false (and a toast) when it refused.
  const put = async (address, body, failure) => {
    const response = await WebHelper.putAsync(address, body);
    if (!response?.ok) {
      await showError(failure, response);
      return false;
    }
    apply(await response.json());
    return true;
  };

  const saveRegistry = async (mainRepository, featuredAddons) => {
    setBusy(true);
    try {
      return await put("serversettings/addon-registry", { mainRepository, featuredAddons }, "Could not save the addon registry");
    } finally {
      setBusy(false);
    }
  };

  if (settings === undefined) return <Text>Loading server settings…</Text>;
  if (settings === null) return <Text color="red.300">Could not load the server settings.</Text>;

  const { canEdit, proxyAllowedPrivateHosts: hosts, sandboxAllowedOrigins: origins, addonRegistry } = settings;
  const repository = addonRegistry.mainRepository;
  const featured = addonRegistry.featuredAddons;
  const featuredInUse = featured.saved ?? featured.fromConfig ?? [];

  return (
    <Stack gap={6} maxW="5xl">
      {settings.error && (
        <Box borderWidth="1px" borderColor="red.400" borderRadius="md" p={3}>
          <Text>{settings.error}</Text>
        </Box>
      )}
      {!canEdit && (
        <Box borderWidth="1px" borderColor="orange.400" borderRadius="md" p={3}>
          <Text>
            The server's owner turned off changing these settings here (Security:AllowRuntimeSettings in
            appsettings). They can only be changed in the server's configuration.
          </Text>
        </Box>
      )}
      <Text fontSize="sm" color="fg.muted">
        Entries with a lock come from the server's appsettings and can only be changed there. Changes made
        here apply at once.
      </Text>

      <Section title="Local network access">
        <Text fontSize="sm" color="fg.muted">
          Hosts on this machine or your network that actions may send requests to (Send Request, Download
          Resource), e.g. a Trilium on localhost:8080. Everything else private stays blocked. Use a host or
          host:port, without http:// or a path; without a port, any port is allowed.
        </Text>
        <ListSetting
          locked={hosts.locked}
          entries={hosts.entries}
          canEdit={canEdit}
          placeholder="localhost:8080 or trilium.lan"
          inputLabel="Private host"
          addLabel="Add private host"
          onSave={(list) => put("serversettings/proxy-allowed-private-hosts", { hosts: list }, "Could not save the private hosts")}
        />
      </Section>

      <Section title="Card sandbox">
        <Text fontSize="sm" color="fg.muted">
          Hosts addon cards and Html chat messages may load scripts, styles, fonts and images from. Only
          https origins, e.g. https://cdn.example.com or https://*.example.com. Players see a change after
          they reload the game.
        </Text>
        <ListSetting
          locked={origins.locked}
          entries={origins.entries}
          canEdit={canEdit}
          placeholder="https://cdn.example.com"
          inputLabel="Sandbox origin"
          addLabel="Add sandbox origin"
          onSave={(list) => put("serversettings/sandbox-allowed-origins", { origins: list }, "Could not save the sandbox origins")}
        />
      </Section>

      <Section title="Addon registry">
        <Text fontSize="sm" color="fg.muted">
          Where addons are listed and downloaded from (an https addons.json), and which of them are offered
          when a game is created.
        </Text>
        <Text fontSize="sm">
          In use: <b>{repository.saved ?? repository.fromConfig ?? "none"}</b>{" "}
          {repository.saved ? "(set here)" : repository.fromConfig ? "(from appsettings)" : ""}
        </Text>
        <HStack>
          <Input
            maxW="xl"
            aria-label="Registry URL"
            placeholder={repository.fromConfig ?? "https://…/addons.json"}
            value={repositoryDraft}
            disabled={!canEdit}
            onChange={(e) => setRepositoryDraft(e.target.value)}
          />
          <Button
            aria-label="Save registry"
            disabled={!canEdit || busy}
            onClick={() => saveRegistry(repositoryDraft.trim() || null, featured.saved ?? null)}
          >
            Save
          </Button>
          {repository.saved && (
            <Button
              variant="outline"
              aria-label="Use the server config registry"
              disabled={!canEdit || busy}
              onClick={() => saveRegistry(null, featured.saved ?? null)}
            >
              Use appsettings
            </Button>
          )}
        </HStack>

        <Heading size="sm">Featured addons {featured.saved ? "(set here)" : "(from appsettings)"}</Heading>
        <ListSetting
          locked={[]}
          entries={featuredInUse}
          canEdit={canEdit}
          placeholder="Addon key, e.g. dnd5e"
          inputLabel="Featured addon key"
          addLabel="Add featured addon"
          onSave={(list) => saveRegistry(repository.saved ?? null, list)}
        />
        {featured.saved && (
          <Box>
            <Button
              size="sm"
              variant="outline"
              aria-label="Use the server config featured addons"
              disabled={!canEdit || busy}
              onClick={() => saveRegistry(repository.saved ?? null, null)}
            >
              Use appsettings
            </Button>
          </Box>
        )}
      </Section>
    </Stack>
  );
};

export default ServerSettingsTab;
