import React from 'react';
import { Box, Button, HStack, Link, Text } from '@chakra-ui/react';
import { Game } from '../components/game/Game';
import { ActiveTransportManager } from '../helpers/transport';
import { setDemoRole } from '../helpers/appMode';
import { toaster } from '../components/ui/toaster';
import gmFixture from './fixtures/gm.json';
import playerFixture from './fixtures/player.json';
import { pickFixture } from './demoFixtures';

// The public demo: the real game screen, answered in the browser from recorded data,
// or the mock game until there is a recording (DemoTransport + DemoServer). Either the GM's or a player's view; nothing is saved.

const TOUR_KEY = 'nm_tour_player_v1';
const DOCS_URL = 'https://nordvikmanager.pl/user-guide/';

const roleFromUrl = () => (new URLSearchParams(window.location.search).get('role') === 'player' ? 'player' : 'gm');

const setRoleInUrl = (role) => {
  const url = new URL(window.location.href);
  if (role === 'player') url.searchParams.set('role', 'player');
  else url.searchParams.delete('role');
  window.history.replaceState(null, '', url);
};

const onNote = (text, { quiet } = {}) => {
  if (quiet) {
    console.info(`[Demo] ${text}`);
    return;
  }
  toaster.create({ description: text, type: 'info', duration: 4000 });
};

const defaultFixtures = () => ({ gm: pickFixture(gmFixture, 'gm'), player: pickFixture(playerFixture, 'player') });

export const DemoApp = ({ fixtures: given }) => {
  const fixtures = React.useMemo(() => given ?? defaultFixtures(), [given]);
  const [role, setRole] = React.useState(roleFromUrl);
  const [run, setRun] = React.useState(0);
  const key = `${role}-${run}`;

  // Load the view's data before the game renders: Game starts the transport while rendering.
  const loadedRef = React.useRef(null);
  if (loadedRef.current !== key) {
    loadedRef.current = key;
    setDemoRole(role);
    if (role === 'player') {
      try { window.localStorage.removeItem(TOUR_KEY); } catch { /* storage blocked: no tour */ }
    }
    ActiveTransportManager.Close();
    ActiveTransportManager.load(fixtures[role], { onNote });
  }

  const gameId = fixtures[role]?.requests?.['GET api/battlemap/getfullgame']?.body?.id ?? 'demo';
  const switchTo = (next) => {
    if (next === role) return;
    setRoleInUrl(next);
    setRole(next);
  };
  const restart = () => setRun((n) => n + 1);

  return (
    <>
      <Game key={key} gameID={gameId} centralSessionId="demo" onExit={restart} />
      <Box className="nm_demoBanner" position="fixed" top="2px" right="8px" zIndex={10000}>
        <HStack
          gap="6px"
          px="8px"
          py="2px"
          borderRadius="md"
          bg="blackAlpha.700"
          color="white"
          fontSize="xs"
          boxShadow="md"
        >
          <Text fontWeight="bold">Demo</Text>
          <Text opacity={0.8}>nothing is saved</Text>
          <HStack gap="0">
            {[['gm', 'GM'], ['player', 'Player']].map(([value, label]) => (
              <Button
                key={value}
                size="2xs"
                variant={role === value ? 'solid' : 'outline'}
                aria-pressed={role === value}
                onClick={() => switchTo(value)}
              >
                {label}
              </Button>
            ))}
          </HStack>
          <Button size="2xs" variant="ghost" color="white" onClick={restart}>Reset</Button>
          <Link href={DOCS_URL} target="_blank" rel="noopener noreferrer" color="white" textDecoration="underline">
            Guide
          </Link>
        </HStack>
      </Box>
    </>
  );
};

export default DemoApp;
