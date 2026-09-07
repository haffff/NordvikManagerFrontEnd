import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameList from './gameLobby/GameList';
import { Game } from './game/Game';
import WebHelper from '../helpers/WebHelper';
import TokenStore from '../helpers/TokenStore';
import { ActiveTransportManager as TransportManager } from '../helpers/transport';
import FabricTypesInitialize from './FabricTypesInitializer';
import { resetPersistedMenuItems } from './uiComponents/base/DDItems/DropDownMenu';

export const MainApp = ({ onAuthRequired }) => {
    const [gameID, setGameID] = useState();
    const [centralSessionId, setCentralSessionId] = useState();
    const [startingSession, setStartingSession] = useState(false);
    const [sessionError, setSessionError] = useState(null);

    // Stable ref so handleExit can read current gameID without being in its dep array
    const currentGameIdRef = useRef();
    currentGameIdRef.current = gameID;

    useEffect(() => {
        FabricTypesInitialize();

        return () => {
            console.log('MainApp: Component unmounting, cleaning up');
            TransportManager.Close();
            WebHelper.GameId = undefined;
        };
    }, []);

    const handleLogout = useCallback(() => {
        // Use fetch directly — WebHelper.getNoResp appends ?gameid=undefined
        // at lobby stage which causes the backend to reject the request before
        // clearing the session cookie.
        fetch(`${WebHelper.ApiAddress}/user/logout`, { method: 'GET', credentials: 'include' })
            .finally(() => { onAuthRequired?.(); });
    }, [onAuthRequired]);

    const handleGameSelected = useCallback(async (id) => {
        setStartingSession(true);
        setSessionError(null);
        try {
            const resp = await fetch(`${WebHelper.ApiAddress}/session/${id}/start`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });

            // 401 = session cookie expired; 400 is also returned by this backend
            // when the auth cookie is missing or invalid — either way the user
            // needs to re-authenticate.
            if (resp.status === 401 || resp.status === 400) {
                onAuthRequired?.();
                return;
            }

            if (!resp.ok) throw new Error(`Session start failed (${resp.status})`);
            const { centralSessionId: csId, centralAccessToken } = await resp.json();

            // Store the Central Server access token so WebRTCManager can use it
            // for signaling — obtained via the GM backend (same-origin, no CORS)
            if (centralAccessToken) {
                TokenStore.setTokens(centralAccessToken, TokenStore.getRefreshToken());
            }

            setCentralSessionId(csId);
            setGameID(id);
        } catch (e) {
            console.error('MainApp: Session start failed:', e);
            setSessionError(e.message);
        } finally {
            setStartingSession(false);
        }
    }, [onAuthRequired]);

    const handleAuthFailure = useCallback(() => {
        console.log('MainApp: Auth failure from central server, redirecting to login');
        onAuthRequired?.();
    }, [onAuthRequired]);

    const handleExit = useCallback(() => {
        console.log('MainApp: Exiting game, stopping session');

        try {
            // Always close, regardless of isConnected() (== WebSocketReady): after a
            // PEER_LEFT event, or an exit mid-handshake, WebSocketReady is already false
            // but WebSocketStarted is still true, which used to make Start() no-op on the
            // next game join, stranding the player on a dead transport. Close() is safe to
            // call even when nothing is connected/started.
            TransportManager.Close();
        } catch (error) {
            console.error('MainApp: Error closing transport:', error);
        }

        const id = currentGameIdRef.current;
        if (id) {
            // Fire-and-forget — don't block the UI on the stop call
            fetch(`${WebHelper.ApiAddress}/session/${id}/stop`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            }).catch((e) => console.warn('MainApp: session/stop failed:', e));
        }

        // Reset per-session, module-level singleton state so it doesn't leak into
        // the next game (see resetPersistedMenuItems's own comment for why).
        resetPersistedMenuItems();

        TokenStore.clear();
        setGameID(undefined);
        setCentralSessionId(undefined);
    }, []);

    if (startingSession) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                Starting session…
            </div>
        );
    }

    if (sessionError) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '1rem' }}>
                <div style={{ color: 'salmon' }}>Failed to start session: {sessionError}</div>
                <button onClick={() => setSessionError(null)}>Back</button>
            </div>
        );
    }

    if (gameID === undefined) {
        return (
            <GameList
                OnSuccess={handleGameSelected}
                OnLogout={handleLogout}
            />
        );
    }

    return (
        <Game
            key={gameID}
            onExit={handleExit}
            onAuthFailure={handleAuthFailure}
            gameID={gameID}
            centralSessionId={centralSessionId}
        />
    );
}
export default MainApp;
