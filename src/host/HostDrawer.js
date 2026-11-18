// The host build's drawer, opened by the host button (HostButton): this tab is the game's server
// (the browser host). The Host tab: what runs, the browser's storage, and the startup dialog again
// (what the browser version can't do); the Logs tab: the host's log (host.js keeps it in the page).
import React, { useEffect } from 'react';
import { Badge, Button, Stack, Tabs, Text } from '@chakra-ui/react';
import {
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerRoot,
  DrawerTitle,
} from '../components/ui/drawer';
import { HostLogs } from './HostLogs';
import { formatBytes, useStorageEstimate } from './storageHelp';
import { setHostUi, useHostUi } from './hostUi';

/** Counts errors logged while the Logs tab isn't being read (the host button shows the count). */
function useUnreadErrors(logs, reading) {
  useEffect(() => {
    if (!logs || reading) {
      setHostUi({ unread: 0 });
      return undefined;
    }
    return logs.subscribe((line) => {
      if (line.level === 'error') setHostUi((s) => ({ unread: s.unread + 1 }));
    });
  }, [logs, reading]);
}

/**
 * @param info  the backend's api/Host/Info (null until it's known)
 * @param logs  host.js's log (lines, subscribe, clear)
 */
export const HostDrawer = ({ info, logs }) => {
  const { drawerOpen, drawerTab, sessions, persisted } = useHostUi();
  useUnreadErrors(logs, drawerOpen && drawerTab === 'logs');
  const storage = useStorageEstimate(drawerOpen);
  const { unread } = useHostUi();

  return (
    <DrawerRoot open={drawerOpen} onOpenChange={(e) => setHostUi({ drawerOpen: e.open })} placement="end" size="md">
      <DrawerBackdrop />
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Game host: this tab</DrawerTitle>
        </DrawerHeader>
        <DrawerCloseTrigger />
        <DrawerBody>
          <Tabs.Root value={drawerTab} onValueChange={(e) => setHostUi({ drawerTab: e.value })} size="sm" variant="line" lazyMount>
            <Tabs.List marginBottom={4}>
              <Tabs.Trigger value="host">Host</Tabs.Trigger>
              <Tabs.Trigger value="logs">Logs{unread > 0 ? ` (${unread})` : ''}</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="host">
              <Stack gap={4}>
                <Text fontSize="sm">
                  Your games run in this browser tab and are kept in this browser, not on a local server.
                </Text>
                <Stack direction="row" gap={2} wrap="wrap">
                  <Badge colorPalette={sessions > 0 ? 'green' : 'gray'}>
                    {sessions > 0 ? `${sessions} game${sessions === 1 ? '' : 's'} running` : 'No game running'}
                  </Badge>
                  {info?.version && <Badge>Version {info.version}</Badge>}
                  {info?.protocol != null && <Badge>Protocol {info.protocol}</Badge>}
                </Stack>
                {storage && (
                  <Text fontSize="xs" color="fg.muted">
                    Storage: {formatBytes(storage.usage)} used of {formatBytes(storage.quota)} the browser allows this site.
                  </Text>
                )}
                {persisted === false && (
                  <Text fontSize="xs" color="fg.warning">
                    The browser hasn't granted this site persistent storage: it may clear your games when the disk is nearly full.
                  </Text>
                )}
                {info?.limitations && (
                  <Button size="sm" variant="outline" alignSelf="flex-start"
                    onClick={() => setHostUi({ drawerOpen: false, introOpen: true })}>
                    What the browser version can't do
                  </Button>
                )}
              </Stack>
            </Tabs.Content>
            <Tabs.Content value="logs">
              <HostLogs logs={logs} />
            </Tabs.Content>
          </Tabs.Root>
        </DrawerBody>
      </DrawerContent>
    </DrawerRoot>
  );
};

export default HostDrawer;
