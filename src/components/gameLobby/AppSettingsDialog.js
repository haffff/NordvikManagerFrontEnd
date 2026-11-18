import * as React from "react";
import { Button, Tabs } from "@chakra-ui/react";
import {
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
} from "../ui/dialog";
import { BackupSettingsTab } from "./appSettings/BackupSettingsTab";
import { ServerSettingsTab } from "./appSettings/ServerSettingsTab";

// backups / server: whether the backend has them (a browser host has neither).
export const AppSettingsDialog = ({ openRef, backups = true, server = true }) => {
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState("backups");
  const shownTab = !backups ? "server" : !server ? "backups" : tab;

  // openRef.current("server") opens on that tab (the lobby's update notice).
  openRef.current = (startTab) => {
    if (typeof startTab === "string") setTab(startTab);
    setOpen(true);
  };

  return (
    <DialogRoot
      lazyMount
      open={open}
      onOpenChange={(e) => setOpen(e.open)}
      size={"cover"}
    >
      <DialogBackdrop />
      <DialogContent>
        <DialogCloseTrigger />
        <DialogHeader>Application Settings</DialogHeader>
        <DialogBody>
          <Tabs.Root value={shownTab} onValueChange={(e) => setTab(e.value)} lazyMount size="md" variant="enclosed">
            <Tabs.List>
              {backups && <Tabs.Trigger value="backups">Backups</Tabs.Trigger>}
              {server && <Tabs.Trigger value="server">Server</Tabs.Trigger>}
            </Tabs.List>
            {backups && (
              <Tabs.Content value="backups">
                <BackupSettingsTab />
              </Tabs.Content>
            )}
            {server && (
              <Tabs.Content value="server">
                <ServerSettingsTab />
              </Tabs.Content>
            )}
          </Tabs.Root>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

export default AppSettingsDialog;
