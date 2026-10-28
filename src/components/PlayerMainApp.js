import { useState, useCallback, useEffect } from 'react';
import { Box, Button, Heading, Input, Stack, Text } from '@chakra-ui/react';
import { SessionList } from './playerLobby/SessionList';
import { Game } from './game/Game';
import CentralWebHelper from '../helpers/CentralWebHelper';
import TokenStore from '../helpers/TokenStore';
import WebRTCManagerInstance from './game/WebRTCManager';
import FabricTypesInitialize from './FabricTypesInitializer';

const AutoJoinScreen = ({
  state, error, requiresPassword, passwordInput,
  onPasswordChange, onSubmit, onCancel,
}) => (
  <Box
    display="flex" flexDirection="column" alignItems="center" justifyContent="center"
    height="100vh" gap={4}
  >
    {state === 'pending' && <Text color="gray.400">Connecting to game…</Text>}

    {state === 'password' && (
      <Stack gap={3} width="320px">
        <Heading size="sm">Password required</Heading>
        <Input
          type="password"
          placeholder="Game password"
          value={passwordInput}
          onInput={(e) => onPasswordChange(e.target.value)}
          onKeyUp={(e) => { if (e.key === 'Enter') onSubmit(); }}
        />
        <Button variant="outline" colorPalette="green" onClick={onSubmit}>Join</Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Back to lobby</Button>
      </Stack>
    )}

    {state === 'error' && (
      <Stack gap={3} alignItems="center">
        <Box p={3} borderRadius="md" bg="red.950" border="1px solid" borderColor="red.700">
          <Text fontSize="sm" color="red.300">{error}</Text>
        </Box>
        {requiresPassword && (
          <Stack gap={3} width="320px">
            <Input
              type="password"
              placeholder="Try a different password"
              value={passwordInput}
              onInput={(e) => onPasswordChange(e.target.value)}
              onKeyUp={(e) => { if (e.key === 'Enter') onSubmit(); }}
            />
            <Button variant="outline" colorPalette="green" onClick={onSubmit}>Retry</Button>
          </Stack>
        )}
        <Button variant="ghost" size="sm" onClick={onCancel}>Back to lobby</Button>
      </Stack>
    )}
  </Box>
);

export const PlayerMainApp = ({ autoGameId = null, requiresPassword = false, onAuthRequired }) => {
  const [sessionId, setSessionId] = useState(undefined);
  const [centralSessionId, setCentralSessionId] = useState(undefined);
  const [autoJoinState, setAutoJoinState] = useState(
    autoGameId ? 'pending' : null   // 'pending' | 'password' | 'error' | null
  );
  const [autoJoinError, setAutoJoinError] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');

  useEffect(() => {
    FabricTypesInitialize();
    return () => {
      if (WebRTCManagerInstance.WebSocketStarted) {
        WebRTCManagerInstance.Close();
      }
    };
  }, []);

  // Unified handler for when a session is ready to enter (from list click or join response)
  const handleSessionReady = useCallback((id, csId) => {
    setSessionId(id);
    setCentralSessionId(csId);
    setAutoJoinState(null);
  }, []);

  // Auto-join from URL param
  useEffect(() => {
    if (!autoGameId || autoJoinState !== 'pending') return;
    if (requiresPassword) {
      setAutoJoinState('password');
      return;
    }
    doJoin(autoGameId, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doJoin = useCallback(async (id, password) => {
    setAutoJoinState('pending');
    setAutoJoinError(null);
    try {
      const resp = await CentralWebHelper.postAsync('gamelist/join', {
        gameID: id,
        ...(password ? { password } : {}),
      });
      if (resp?.ok || resp?.status === 409) {
        // 409 = already a member — still proceed; read centralSessionId from body if present
        const body = await resp?.json?.().catch(() => ({}));
        handleSessionReady(id, body?.centralSessionId);
      } else if (resp?.status === 401) {
        // Access token AND refresh token are both expired — user must log in again.
        onAuthRequired?.();
      } else {
        const body = await resp?.json?.().catch(() => ({}));
        setAutoJoinError(body?.error ?? 'Failed to join game.');
        setAutoJoinState('error');
      }
    } catch {
      setAutoJoinError('Connection error. Please try again.');
      setAutoJoinState('error');
    }
  }, [handleSessionReady, onAuthRequired]);

  const handleLogout = useCallback(() => {
    CentralWebHelper.getNoResp(
      'user/logout',
      () => { TokenStore.clear(); window.location.reload(); },
      () => { TokenStore.clear(); window.location.reload(); }
    );
  }, []);

  const handleExit = useCallback(() => {
    WebRTCManagerInstance.Close();
    setSessionId(undefined);
    setCentralSessionId(undefined);
  }, []);

  // Auto-join: password prompt or loading/error screen
  if (autoGameId && autoJoinState !== null && !sessionId) {
    return (
      <AutoJoinScreen
        state={autoJoinState}
        error={autoJoinError}
        requiresPassword={requiresPassword || autoJoinState === 'password'}
        passwordInput={passwordInput}
        onPasswordChange={setPasswordInput}
        onSubmit={() => doJoin(autoGameId, passwordInput || null)}
        onCancel={() => { setAutoJoinState(null); }}
      />
    );
  }

  if (!sessionId) {
    return <SessionList OnSuccess={handleSessionReady} OnJoin={doJoin} OnLogout={handleLogout} />;
  }

  return (
    <Game
      key={sessionId}
      gameID={sessionId}
      onExit={handleExit}
      centralSessionId={centralSessionId}
    />
  );
};

export default PlayerMainApp;
