// The host build's startup dialog: before the GM plays, what hosting from a browser means. A
// warning, the six things that matter most as cards, the rest further down (the backend's own
// lists, GET api/Host/Info), and the choice: the local server, the browser version, or not to be
// asked again. Opens by itself once the host info is in (it answers after login), on each page
// load until "Don't remind me again"; the host drawer opens it any time.
import React, { useEffect, useState } from 'react';
import { Box, Button, Flex, Heading, Icon, Stack, Text } from '@chakra-ui/react';
import { FaExclamationTriangle } from '@react-icons/all-files/fa/FaExclamationTriangle';
import { FaRegWindowRestore } from '@react-icons/all-files/fa/FaRegWindowRestore';
import { FaHdd } from '@react-icons/all-files/fa/FaHdd';
import { FaClone } from '@react-icons/all-files/fa/FaClone';
import { FaSignInAlt } from '@react-icons/all-files/fa/FaSignInAlt';
import { FaImage } from '@react-icons/all-files/fa/FaImage';
import { FaPuzzlePiece } from '@react-icons/all-files/fa/FaPuzzlePiece';
import { FaInfoCircle } from '@react-icons/all-files/fa/FaInfoCircle';
import { FaDownload } from '@react-icons/all-files/fa/FaDownload';
import {
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '../components/ui/dialog';
import { setHostUi, useHostUi } from './hostUi';

export const INTRO_DISMISSED = 'nordvik-host-intro-dismissed';

/** The limitations shown as cards (HostDescription ids), in this order; the rest go below. */
export const CARD_IDS = ['tab-open', 'browser-storage', 'one-tab', 'login-after-reload', 'no-thumbnails', 'addon-registry'];
const ICONS = {
  'tab-open': FaRegWindowRestore,
  'browser-storage': FaHdd,
  'one-tab': FaClone,
  'login-after-reload': FaSignInAlt,
  'no-thumbnails': FaImage,
  'addon-registry': FaPuzzlePiece,
};

const dismissed = () => {
  try { return localStorage.getItem(INTRO_DISMISSED) === '1'; } catch { return false; }
};

const Card = ({ limitation }) => (
  <Box
    data-testid="host-intro-card"
    data-id={limitation.id}
    flex="1 1 220px"
    maxWidth={{ base: '100%', md: 'calc(33.333% - 8px)' }}
    borderWidth="1px"
    borderRadius="md"
    padding={3}
    bg="bg.subtle"
  >
    <Flex gap={2} alignItems="center" marginBottom={1}>
      <Icon as={ICONS[limitation.id] ?? FaInfoCircle} boxSize={4} color="orange.400" flexShrink={0} />
      <Text fontWeight="semibold" fontSize="sm">{limitation.title}</Text>
    </Flex>
    <Text fontSize="xs" color="fg.muted">{limitation.detail}</Text>
  </Box>
);

const Detail = ({ title, children }) => (
  <Box borderLeft="2px solid" borderColor="border.emphasized" paddingLeft={3}>
    {title && <Text fontWeight="semibold" fontSize="sm">{title}</Text>}
    <Text fontSize="sm" color="fg.muted">{children}</Text>
  </Box>
);

/**
 * @param info     the backend's api/Host/Info (null until it's known)
 * @param central  Central's URL (its landing page has the local server's download)
 */
export const HostIntroDialog = ({ info, central }) => {
  const { introOpen } = useHostUi();
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoDone, setAutoDone] = useState(false);
  const known = info?.kind === 'browser' && Array.isArray(info.limitations);

  // Once per page load, when the info first arrives.
  useEffect(() => {
    if (!known || autoDone) return;
    setAutoDone(true);
    if (!dismissed()) setAutoOpen(true);
  }, [known, autoDone]);

  const close = () => {
    setAutoOpen(false);
    setHostUi({ introOpen: false });
  };

  if (!known) return null;

  const limitations = info.limitations;
  const cards = CARD_IDS.map((id) => limitations.find((l) => l.id === id)).filter(Boolean);
  const rest = limitations.filter((l) => !CARD_IDS.includes(l.id));

  return (
    <DialogRoot open={autoOpen || introOpen} onOpenChange={(e) => { if (!e.open) close(); }} size="xl" scrollBehavior="inside" placement="center">
      <DialogBackdrop />
      <DialogContent>
        <DialogHeader>
          <Flex gap={3} alignItems="center">
            <Icon as={FaExclamationTriangle} boxSize={7} color="orange.400" flexShrink={0} />
            <Stack gap={0}>
              <DialogTitle>You're hosting from your browser</DialogTitle>
              <Text fontSize="sm" color="fg.muted">
                This is the browser version of the game host: your games run in this tab and are kept in this browser.
                It's good for trying things out and short sessions. For regular play, the local server (a small program
                on your computer) is more dependable.
              </Text>
            </Stack>
          </Flex>
        </DialogHeader>
        <DialogBody>
          <Flex gap={3} wrap="wrap">
            {cards.map((l) => <Card key={l.id} limitation={l} />)}
          </Flex>

          {(rest.length > 0 || info.unavailable?.length > 0) && (
            <Stack gap={4} marginTop={6}>
              {rest.length > 0 && (
                <Stack gap={2}>
                  <Heading size="sm">Also good to know</Heading>
                  {rest.map((l) => <Detail key={l.id} title={l.title}>{l.detail}</Detail>)}
                </Stack>
              )}
              {info.unavailable?.length > 0 && (
                <Stack gap={2}>
                  <Heading size="sm">Only on the local server</Heading>
                  {info.unavailable.map((u) => <Detail key={u.path}>{u.reason}</Detail>)}
                </Stack>
              )}
            </Stack>
          )}
        </DialogBody>
        <DialogFooter flexWrap="wrap" gap={2}>
          <Button
            variant="ghost"
            size="sm"
            marginRight="auto"
            onClick={() => {
              try { localStorage.setItem(INTRO_DISMISSED, '1'); } catch { /* shown again next time */ }
              close();
            }}
          >
            Don't remind me again
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.open(`${(central ?? '').replace(/\/+$/, '')}/#download`, '_blank', 'noopener');
              close();
            }}
          >
            <FaDownload /> I will download local server
          </Button>
          <Button colorPalette="orange" size="sm" onClick={close}>Continue with browser version</Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

export default HostIntroDialog;
