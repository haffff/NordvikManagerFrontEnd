// The host build (REACT_APP_MODE=host): the GM app, with its GM backend running in this tab.
// The backend is the browser host (NordvikManager.Wasm.Host's AppBundle, which the build puts in
// ./wasm/ next to this app: a worker must be this page's own origin). Its host.js starts it;
// the GM app's fetch()es to its API are answered by it (hostFetch). The tab is the game's server
// for the players, so it asks before going away while a game runs.
import React, { useCallback, useEffect, useState } from 'react';
import { Box, Heading, Spinner, Stack, Text } from '@chakra-ui/react';
import { GMApp } from '../components/GMApp';
import { HostDrawer } from './HostDrawer';
import { hostFetch } from './hostFetch';
import { loadHostInfo, resetHostInfo } from './hostInfo';

const BUNDLE = './wasm/host.js';

/** A beforeunload handler: asks first while `running()` sessions are going. */
export const keepTabWhileRunning = (running) => (e) => {
  if (running() > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
};

const Screen = ({ title, children }) => (
  <Box display="flex" alignItems="center" justifyContent="center" height="100vh" padding={4}>
    <Stack gap={3} maxWidth="480px" textAlign="center" alignItems="center">
      <Heading size="md">{title}</Heading>
      {children}
    </Stack>
  </Box>
);

let started = null; // once per page, whatever React does with effects

function startOnce() {
  if (!started) {
    started = (async () => {
      const { startHost } = await import(/* @vite-ignore */ new URL(BUNDLE, document.baseURI).href);
      const central = (process.env.REACT_APP_CENTRAL_URL || window.location.origin).replace(/\/+$/, '');
      let failed = () => {};
      const { ready } = startHost({ central, onFailed: (e) => failed(e) });
      const result = await ready;
      return { ...result, central, onFailed: (fn) => { failed = fn; } };
    })();
  }
  return started;
}

export const HostApp = () => {
  const [state, setState] = useState({ phase: 'starting' });
  const [info, setInfo] = useState(null);
  const [sessions, setSessions] = useState(0);

  const refreshInfo = useCallback(() => {
    resetHostInfo();
    loadHostInfo().then(setInfo);
  }, []);

  useEffect(() => {
    let live = true;
    startOnce().then(({ host, persisted, central, onFailed }) => {
      if (!live) return;
      onFailed(({ message }) => setState({ phase: 'failed', message }));
      window.fetch = hostFetch(host, window.fetch.bind(window), {
        central,
        onSessions: (running) => setSessions(running.size),
        onLogin: refreshInfo,
      });
      setState({ phase: 'ready', persisted });
    }, (err) => {
      if (live) setState({ phase: err?.name === 'locked' ? 'locked' : 'failed', message: err?.message ?? String(err) });
    });
    return () => { live = false; };
  }, [refreshInfo]);

  useEffect(() => {
    const handler = keepTabWhileRunning(() => sessions);
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [sessions]);

  if (state.phase === 'starting') {
    return (
      <Screen title="Starting the game host…">
        <Spinner />
        <Text color="fg.muted" fontSize="sm">Your games run in this tab and are kept in this browser.</Text>
      </Screen>
    );
  }
  if (state.phase === 'locked') {
    return (
      <Screen title="Your games are open in another tab">
        <Text color="fg.muted">{state.message}</Text>
      </Screen>
    );
  }
  if (state.phase === 'failed') {
    return (
      <Screen title="The game host stopped">
        <Text color="fg.error">{state.message}</Text>
        <Text color="fg.muted" fontSize="sm">Reload the page to start it again. Your games are kept in this browser.</Text>
      </Screen>
    );
  }
  return (
    <>
      <GMApp />
      <HostDrawer info={info} sessions={sessions} persisted={state.persisted} />
    </>
  );
};

export default HostApp;
