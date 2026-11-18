// The host build (REACT_APP_MODE=host): the GM app, with its GM backend running in this tab.
// The backend is the browser host (NordvikManager.Wasm.Host's AppBundle, which the build puts in
// ./wasm/ next to this app: a worker must be this page's own origin). Its host.js starts it;
// the GM app's fetch()es to its API are answered by it (hostFetch). The tab is the game's server
// for the players, so it asks before going away while a game runs.
import React, { useCallback, useEffect, useState } from 'react';
import { Box, Heading, Spinner, Stack, Text } from '@chakra-ui/react';
import { GMApp } from '../components/GMApp';
import { HostDrawer } from './HostDrawer';
import { HostLogs } from './HostLogs';
import { StorageBanner } from './StorageBanner';
import { askOnFirstClick } from './storageHelp';
import { HostButton } from './HostButton';
import { HostIntroDialog } from './HostIntroDialog';
import { setHostUi, useHostUi } from './hostUi';
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

// { logs, central, onFailed(fn), ready }: the log from the start, before the host is ready.
function startOnce() {
  if (!started) {
    started = (async () => {
      const { startHost } = await import(/* @vite-ignore */ new URL(BUNDLE, document.baseURI).href);
      const central = (process.env.REACT_APP_CENTRAL_URL || window.location.origin).replace(/\/+$/, '');
      let failed = () => {};
      const { ready, logs } = startHost({ central, onFailed: (e) => failed(e) });
      return { ready, logs, central, onFailed: (fn) => { failed = fn; } };
    })();
  }
  return started;
}

export const HostApp = () => {
  const [state, setState] = useState({ phase: 'starting' });
  const [info, setInfo] = useState(null);
  const [sessions, setSessions] = useState(0);
  const [logs, setLogs] = useState(null);
  const [persisted, setPersisted] = useState(undefined);
  const [central, setCentral] = useState(null);
  const { buttons } = useHostUi();

  // What the host button shows, wherever it is.
  useEffect(() => { setHostUi({ persisted, sessions }); }, [persisted, sessions]);

  const refreshInfo = useCallback(() => {
    resetHostInfo();
    loadHostInfo().then(setInfo);
  }, []);

  useEffect(() => {
    let live = true;
    const fail = (err) => {
      if (live) setState({ phase: err?.name === 'locked' ? 'locked' : 'failed', message: err?.message ?? String(err) });
    };
    startOnce().then(({ ready, logs: hostLogs, central: centralUrl, onFailed }) => {
      if (!live) return;
      setLogs(hostLogs);
      setCentral(centralUrl);
      onFailed(({ message }) => setState({ phase: 'failed', message }));
      ready.then(({ host, persisted: granted }) => {
        if (!live) return;
        window.fetch = hostFetch(host, window.fetch.bind(window), {
          central: centralUrl,
          onSessions: (running) => setSessions(running.size),
          onLogin: refreshInfo,
        });
        setPersisted(granted);
        setState({ phase: 'ready' });
      }, fail);
    }, fail);
    return () => { live = false; };
  }, [refreshInfo]);

  // Not granted at start: ask again on the GM's first click (Firefox prompts only then).
  useEffect(() => {
    if (persisted !== false) return undefined;
    return askOnFirstClick(document, () => navigator.storage.persist(), (granted) => { if (granted) setPersisted(true); });
  }, [persisted]);

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
        {logs && (
          <Box width="min(720px, calc(100vw - 32px))" textAlign="left">
            <HostLogs logs={logs} height="40vh" />
          </Box>
        )}
      </Screen>
    );
  }
  return (
    <>
      <GMApp />
      {/* The lobby's and the game's toolbars have their own; elsewhere (login) a floating one. */}
      {buttons === 0 && <HostButton position="fixed" top="5px" right="8px" zIndex={1400} floating />}
      <StorageBanner persisted={persisted} onPersisted={setPersisted} />
      <HostDrawer info={info} logs={logs} />
      <HostIntroDialog info={info} central={central} />
    </>
  );
};

export default HostApp;
