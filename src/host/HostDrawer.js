// The host build's info button and drawer: this tab is the game's server (the browser host), and
// what that means for the GM. Shown over the lobby and the game alike. The lists are the
// backend's own (GET api/Host/Info): its limitations, and what only a GM server does; the Logs tab
// is the host's log (host.js keeps it in the page).
//
// The button's badges: a warning sign while the browser may delete the games (no persistent
// storage), and how many errors were logged since the Logs tab was last looked at.
import React, { useEffect, useState } from 'react';
import { Badge, Box, Heading, IconButton, Stack, Tabs, Text } from '@chakra-ui/react';
import { FaServer } from '@react-icons/all-files/fa/FaServer';
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

const Section = ({ title, children }) => (
  <Stack gap={2}>
    <Heading size="sm">{title}</Heading>
    {children}
  </Stack>
);

const Item = ({ title, children }) => (
  <Box borderLeft="2px solid" borderColor="border.emphasized" paddingLeft={3}>
    {title && <Text fontWeight="semibold" fontSize="sm">{title}</Text>}
    <Text fontSize="sm" color="fg.muted">{children}</Text>
  </Box>
);

const Dot = ({ testId, bg, children, right }) => (
  <Box
    data-testid={testId}
    position="absolute"
    top="-4px"
    right={right}
    minWidth="14px"
    height="14px"
    paddingX="3px"
    borderRadius="full"
    bg={bg}
    color="white"
    fontSize="9px"
    fontWeight="bold"
    lineHeight="14px"
    textAlign="center"
    pointerEvents="none"
  >
    {children}
  </Box>
);

/** Errors logged since the Logs tab was last open. */
function useUnreadErrors(logs, reading) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!logs || reading) {
      setUnread(0);
      return undefined;
    }
    return logs.subscribe((line) => { if (line.level === 'error') setUnread((n) => n + 1); });
  }, [logs, reading]);
  return unread;
}

/**
 * @param info       the backend's api/Host/Info (null until it's known)
 * @param sessions   how many game sessions this tab is running
 * @param persisted  whether the browser keeps this site's storage when the disk is nearly full
 * @param logs       host.js's log (lines, subscribe, clear)
 */
export const HostDrawer = ({ info, sessions = 0, persisted, logs }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('host');
  const unread = useUnreadErrors(logs, open && tab === 'logs');
  const storageWarning = persisted === false;

  const label = [
    'Game host: this tab',
    storageWarning ? "storage isn't persistent" : null,
    unread ? `${unread} new error${unread === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(', ');

  return (
    <>
      <Box position="fixed" top="5px" right="8px" zIndex={1400}>
        <IconButton
          aria-label={label}
          title={label}
          size="xs"
          variant="surface"
          borderRadius="full"
          colorPalette={storageWarning ? 'orange' : sessions > 0 ? 'green' : 'gray'}
          onClick={() => setOpen(true)}
        >
          <FaServer />
        </IconButton>
        {storageWarning && <Dot testId="host-badge-warning" bg="orange.500" right={unread ? '12px' : '-4px'}>!</Dot>}
        {unread > 0 && <Dot testId="host-badge-errors" bg="red.600" right="-6px">{unread > 99 ? '99+' : unread}</Dot>}
      </Box>
      <DrawerRoot open={open} onOpenChange={(e) => setOpen(e.open)} placement="end" size="md">
        <DrawerBackdrop />
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Game host: this tab</DrawerTitle>
          </DrawerHeader>
          <DrawerCloseTrigger />
          <DrawerBody>
            <Tabs.Root value={tab} onValueChange={(e) => setTab(e.value)} size="sm" variant="line" lazyMount>
              <Tabs.List marginBottom={4}>
                <Tabs.Trigger value="host">Host</Tabs.Trigger>
                <Tabs.Trigger value="logs">Logs{unread > 0 ? ` (${unread})` : ''}</Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="host">
                <Stack gap={6}>
                  <Stack gap={1}>
                    <Text fontSize="sm">
                      Your games run in this browser tab and are kept in this browser, not on a GM server.
                    </Text>
                    <Stack direction="row" gap={2} wrap="wrap">
                      <Badge colorPalette={sessions > 0 ? 'green' : 'gray'}>
                        {sessions > 0 ? `${sessions} game${sessions === 1 ? '' : 's'} running` : 'No game running'}
                      </Badge>
                      {info?.version && <Badge>Version {info.version}</Badge>}
                      {info?.protocol != null && <Badge>Protocol {info.protocol}</Badge>}
                    </Stack>
                    {storageWarning && (
                      <Text fontSize="xs" color="fg.warning">
                        The browser hasn't granted this site persistent storage: it may clear your games when the disk is nearly full.
                      </Text>
                    )}
                  </Stack>

                  <Section title="What to expect">
                    {info?.limitations?.length
                      ? info.limitations.map((l) => <Item key={l.id} title={l.title}>{l.detail}</Item>)
                      : <Text fontSize="sm" color="fg.muted">Shown once you're logged in.</Text>}
                  </Section>

                  {info?.unavailable?.length > 0 && (
                    <Section title="Only on a GM server">
                      {info.unavailable.map((u) => <Item key={u.path}>{u.reason}</Item>)}
                    </Section>
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
    </>
  );
};

export default HostDrawer;
