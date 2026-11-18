// The host build's "Game host" button: at the right end of the game's toolbar and the lobby's
// (HostApp shows a floating one where there's neither, e.g. the login screen). It opens the host
// drawer, and carries its notices: an orange "!" while the browser may delete the games (no
// persistent storage), and how many errors were logged since the Logs tab was last open.
import React, { useEffect } from 'react';
import { Box, Button } from '@chakra-ui/react';
import { FaServer } from '@react-icons/all-files/fa/FaServer';
import { setHostUi, useHostUi } from './hostUi';

const Badge = ({ testId, bg, right, children }) => (
  <Box
    data-testid={testId}
    position="absolute"
    top="-5px"
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
    zIndex={1}
  >
    {children}
  </Box>
);

export const HostButton = ({ floating = false, ...props }) => {
  const { persisted, sessions, unread } = useHostUi();
  const storageWarning = persisted === false;

  // Counted, so HostApp knows whether a floating one is needed.
  useEffect(() => {
    if (floating) return undefined;
    setHostUi((s) => ({ buttons: s.buttons + 1 }));
    return () => setHostUi((s) => ({ buttons: s.buttons - 1 }));
  }, [floating]);

  const label = [
    'Game host: this tab',
    storageWarning ? "storage isn't persistent" : null,
    unread ? `${unread} new error${unread === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(', ');

  return (
    <Box position="relative" flexShrink={0} {...props}>
      <Button
        aria-label={label}
        title={label}
        height="30px"
        size="xs"
        borderRadius={0}
        variant="outline"
        colorPalette={storageWarning ? 'orange' : sessions > 0 ? 'green' : 'gray'}
        onClick={() => setHostUi({ drawerOpen: true, drawerTab: unread ? 'logs' : 'host' })}
      >
        <FaServer /> Host
      </Button>
      {storageWarning && <Badge testId="host-badge-warning" bg="orange.500" right={unread ? '14px' : '-5px'}>!</Badge>}
      {unread > 0 && <Badge testId="host-badge-errors" bg="red.600" right="-7px">{unread > 99 ? '99+' : unread}</Badge>}
    </Box>
  );
};

export default HostButton;
