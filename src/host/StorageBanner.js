// The host build's warning when the browser hasn't granted this site persistent storage: then the
// browser may delete the games (OPFS) to free space. Dismissed for this tab's session only; the
// host icon keeps its warning sign either way.
import React, { useState } from 'react';
import { Box, Button, HStack, Text } from '@chakra-ui/react';

const DISMISSED = 'nordvik-host-storage-banner-dismissed';

const wasDismissed = () => {
  try { return sessionStorage.getItem(DISMISSED) === '1'; } catch { return false; }
};

/**
 * @param persisted    false: not granted (shown); true or not known yet: nothing
 * @param onPersisted  the browser's new answer after "Ask again"
 */
export const StorageBanner = ({ persisted, onPersisted }) => {
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [asking, setAsking] = useState(false);
  const [refused, setRefused] = useState(false);

  if (persisted !== false || dismissed) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISSED, '1'); } catch { /* this render only */ }
    setDismissed(true);
  };

  const askAgain = async () => {
    setAsking(true);
    try {
      const granted = !!(await navigator.storage?.persist?.());
      setRefused(!granted);
      onPersisted(granted);
    } catch {
      setRefused(true);
    } finally {
      setAsking(false);
    }
  };

  return (
    <Box
      role="alert"
      position="fixed"
      bottom="44px"
      left="50%"
      transform="translateX(-50%)"
      zIndex={1400}
      width="min(720px, calc(100vw - 32px))"
      padding={3}
      borderRadius="md"
      borderWidth="1px"
      borderColor="orange.500"
      bg="orange.950"
      color="orange.100"
      boxShadow="lg"
    >
      <Text fontSize="sm" fontWeight="semibold">Your games aren't safe from cleanup yet</Text>
      <Text fontSize="sm" marginTop={1}>
        This browser hasn't granted this site persistent storage, so it may delete your games when the disk is nearly full.
        Bookmarking this page or installing it as an app usually makes the browser agree; then ask again.
        {refused && ' The browser still says no.'}
      </Text>
      <HStack marginTop={2} gap={2}>
        <Button size="xs" colorPalette="orange" loading={asking} onClick={askAgain}>Ask again</Button>
        <Button size="xs" variant="ghost" color="orange.100" onClick={dismiss}>Dismiss</Button>
      </HStack>
    </Box>
  );
};

export default StorageBanner;
