// The host build's info button and drawer: this tab is the game's server (the browser host), and
// what that means for the GM. Shown over the lobby and the game alike. The lists are the
// backend's own (GET api/Host/Info): its limitations, and what only a GM server does.
import React, { useState } from 'react';
import { Badge, Box, Heading, IconButton, Stack, Text } from '@chakra-ui/react';
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

/**
 * @param info       the backend's api/Host/Info (null until it's known)
 * @param sessions   how many game sessions this tab is running
 * @param persisted  whether the browser keeps this site's storage when the disk is nearly full
 */
export const HostDrawer = ({ info, sessions = 0, persisted }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton
        aria-label="Game host: this tab"
        title="Game host: this tab"
        size="xs"
        variant="surface"
        position="fixed"
        top="5px"
        right="8px"
        zIndex={1400}
        borderRadius="full"
        colorPalette={sessions > 0 ? 'green' : 'gray'}
        onClick={() => setOpen(true)}
      >
        <FaServer />
      </IconButton>
      <DrawerRoot open={open} onOpenChange={(e) => setOpen(e.open)} placement="end" size="md">
        <DrawerBackdrop />
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Game host: this tab</DrawerTitle>
          </DrawerHeader>
          <DrawerCloseTrigger />
          <DrawerBody>
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
                {persisted === false && (
                  <Text fontSize="xs" color="fg.warning">
                    The browser hasn't granted this site persistent storage: it may clear your games when the disk is nearly full.
                  </Text>
                )}
              </Stack>

              <Section title="What to expect">
                {info?.limitations?.length
                  ? info.limitations.map((l) => <Item key={l.id} title={l.title}>{l.detail}</Item>)
                  : <Text fontSize="sm" color="fg.muted">Loading…</Text>}
              </Section>

              {info?.unavailable?.length > 0 && (
                <Section title="Only on a GM server">
                  {info.unavailable.map((u) => <Item key={u.path}>{u.reason}</Item>)}
                </Section>
              )}
            </Stack>
          </DrawerBody>
        </DrawerContent>
      </DrawerRoot>
    </>
  );
};

export default HostDrawer;
