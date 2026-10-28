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

export const AppSettingsDialog = ({ openRef }) => {
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState("backups");

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
          <Tabs.Root value={tab} onValueChange={(e) => setTab(e.value)} lazyMount size="md" variant="enclosed">
            <Tabs.List>
              <Tabs.Trigger value="backups">Backups</Tabs.Trigger>
              <Tabs.Trigger value="server">Server</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="backups">
              <BackupSettingsTab />
            </Tabs.Content>
            <Tabs.Content value="server">
              <ServerSettingsTab />
            </Tabs.Content>
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
