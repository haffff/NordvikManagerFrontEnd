import * as React from "react";
import { Box, Button, Code, Heading, HStack, Link, Stack, Text } from "@chakra-ui/react";

import WebHelper from "../../../helpers/WebHelper";
import { showError } from "./serverErrors";
import { Switch } from "../../ui/switch";
import { Checkbox } from "../../ui/checkbox";

const STEP_LABELS = {
  Downloading: "Downloading",
  BackingUp: "Backing up your data",
  Unpacking: "Unpacking",
  Restarting: "Restarting the server",
};

const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;
const formatDate = (utc) => (utc ? new Date(utc).toLocaleString() : "—");
const isBusy = (step) => step in STEP_LABELS;

/**
 * Application Settings → Server → Updates. Checks Central for a newer server, installs it
 * (backup, download, restart) and follows the server until the new version answers, then
 * reloads the page. The server checks by itself every 6 hours too.
 */
export const UpdateSection = () => {
  const [status, setStatus] = React.useState(undefined);
  const [busy, setBusy] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [backedUpMyself, setBackedUpMyself] = React.useState(false);
  // The version being installed: once the server answers with it, the page reloads.
  const target = React.useRef(null);

  const load = React.useCallback(async () => {
    const result = await WebHelper.getAsync("update");
    if (result) setStatus(result);
    else setStatus((current) => current ?? null);
    return result;
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // While installing, follow the steps; the server goes away while it restarts.
  React.useEffect(() => {
    if (!status || !isBusy(status.step)) return undefined;
    const timer = setInterval(async () => {
      const result = await WebHelper.getAsync("update");
      if (!result) return;
      if (target.current && result.currentVersion === target.current) {
        clearInterval(timer);
        window.location.reload();
        return;
      }
      setStatus(result);
    }, 1500);
    return () => clearInterval(timer);
  }, [status?.step]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (work) => {
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  };

  const respond = async (response, failure) => {
    if (!response?.ok) {
      await showError(failure, response);
      return false;
    }
    setStatus(await response.json());
    return true;
  };

  const check = () => run(async () => respond(await WebHelper.postAsync("update/check", {}), "Could not check for updates"));

  const install = () =>
    run(async () => {
      target.current = status.available.version;
      const response = await WebHelper.postAsync("update/install", { withoutBackup: !status.backupsSupported });
      if (!(await respond(response, "Could not start the update"))) target.current = null;
      setConfirming(false);
    });

  const saveSettings = (channel, noticesOff) =>
    run(async () => respond(await WebHelper.putAsync("update/settings", { channel, noticesOff }), "Could not save the update settings"));

  if (status === undefined) return <Text>Looking for updates…</Text>;
  if (status === null) return <Text color="red.300">Could not load the update status.</Text>;

  const { available, lastResult, step } = status;
  const channel = status.channel === "Dev" ? "dev" : "stable";

  return (
    <Box as="section" aria-label="Updates">
      <Stack gap={3}>
        <Heading size="md">Updates</Heading>
        <Text>
          Installed: <b>NordvikManager {status.currentVersion}</b>
        </Text>

        {lastResult &&
          (lastResult.succeeded ? (
            <Text color="green.300">
              Updated from {lastResult.fromVersion} to {lastResult.toVersion}.
            </Text>
          ) : (
            <Box borderWidth="1px" borderColor="red.400" borderRadius="md" p={3}>
              <Text>
                The update to {lastResult.toVersion} didn't work, so {lastResult.fromVersion} is back. {lastResult.message}
              </Text>
            </Box>
          ))}

        {!status.supported ? (
          <Text color="fg.muted">{status.unsupportedReason}</Text>
        ) : isBusy(step) ? (
          <Box borderWidth="1px" borderColor="blue.400" borderRadius="md" p={3}>
            <Text>
              {STEP_LABELS[step]}
              {step === "Downloading" && available ? ` (${megabytes(status.downloadedBytes)} of ${megabytes(available.size)})` : ""}…
            </Text>
            {step === "Restarting" && (
              <Text fontSize="sm" color="fg.muted">
                Players are disconnected for a moment. This page reloads by itself when the new version is up.
              </Text>
            )}
          </Box>
        ) : (
          <>
            {step === "Failed" && status.error && (
              <Box borderWidth="1px" borderColor="red.400" borderRadius="md" p={3}>
                <Text>{status.error}</Text>
              </Box>
            )}
            {available ? (
              <Stack gap={2}>
                <Text>
                  <b>NordvikManager {available.version} is available</b>
                  {available.prerelease ? " (dev build)" : ""}, released {formatDate(available.publishedAt)}.{" "}
                  <Link href={available.releasePage} target="_blank" rel="noreferrer" colorPalette="blue">
                    What's new
                  </Link>
                </Text>
                {status.underServiceManager ? (
                  <Text fontSize="sm">
                    This server runs as a service. To update it, stop the service, run{" "}
                    <Code>NordvikManager --update</Code> in its folder, then start the service again.
                  </Text>
                ) : !confirming ? (
                  <Box>
                    <Button onClick={() => setConfirming(true)} disabled={busy}>
                      Update to {available.version}
                    </Button>
                  </Box>
                ) : (
                  <Stack gap={2} borderWidth="1px" borderColor="orange.400" borderRadius="md" p={3}>
                    <Text fontSize="sm">
                      {status.backupsSupported
                        ? "The server backs up your data, downloads the update and restarts."
                        : "This server's database can't be backed up from here. Back it up with its own tools first."}{" "}
                      Players in a game are disconnected for a moment.
                    </Text>
                    {!status.backupsSupported && (
                      <Checkbox checked={backedUpMyself} onCheckedChange={(e) => setBackedUpMyself(!!e.checked)}>
                        I backed up the database myself
                      </Checkbox>
                    )}
                    <HStack className="nm_wrapRow">
                      <Button
                        colorPalette="orange"
                        onClick={install}
                        loading={busy}
                        disabled={!status.backupsSupported && !backedUpMyself}
                      >
                        {status.backupsSupported ? "Back up, update and restart" : "Update and restart"}
                      </Button>
                      <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
                        Cancel
                      </Button>
                    </HStack>
                  </Stack>
                )}
              </Stack>
            ) : status.checkError ? null : (
              // Only when the check worked: a failed one knows of no newer version either.
              <Text>This is the latest version.</Text>
            )}
            {status.checkError && <Text color="red.300">{status.checkError}</Text>}
            <HStack className="nm_wrapRow">
              <Button size="sm" variant="outline" onClick={check} disabled={busy}>
                Check now
              </Button>
              <Text fontSize="sm" color="fg.muted">
                Last checked: {formatDate(status.lastChecked)}. The server also checks every 6 hours.
              </Text>
            </HStack>
          </>
        )}

        {status.supported && (
          <Stack gap={2}>
            <Switch checked={channel === "dev"} disabled={busy} onCheckedChange={(e) => saveSettings(e.checked ? "dev" : "stable", status.noticesOff)}>
              Offer dev builds (to try what's coming; they can have bugs)
            </Switch>
            <Switch checked={status.noticesOff} disabled={busy} onCheckedChange={(e) => saveSettings(channel, e.checked)}>
              Don't show update notices in the lobby and console
            </Switch>
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

export default UpdateSection;
