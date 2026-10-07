import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameList from './gameLobby/GameList';
import { Game } from './game/Game';
import WebHelper from '../helpers/WebHelper';
import TokenStore from '../helpers/TokenStore';
import { ActiveTransportManager as TransportManager } from '../helpers/transport';
import FabricTypesInitialize from './FabricTypesInitializer';
import { resetPersistedMenuItems } from './uiComponents/base/DDItems/DropDownMenu';
import { setUrlParam, removeUrlParam } from '../helpers/UrlParamHelper';

export const MainApp = ({ onAuthRequired }) => {
    // GM backend's own internal Games.Id (a GUID string) — NOT Central's
    // centralSessionId (that's what the player build's "?game=" carries, via
    // GameListItem.js's invite link). Safe to reuse the same param name across
    // builds since the GM and player builds are always separately deployed
    // (see CLAUDE.md) — this app instance only ever parses its own meaning.
    const [autoGameId] = useState(() => new URLSearchParams(window.location.search).get('game') || undefined);
    const autoJoinAttemptedRef = useRef(false);
    const startAbortRef = useRef(null);

    const [gameID, setGameID] = useState();
    const [centralSessionId, setCentralSessionId] = useState();
    // Seed to true when auto-joining so GameList doesn't flash for a frame.
    const [startingSession, setStartingSession] = useState(() => Boolean(autoGameId));
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
        const controller = new AbortController();
        startAbortRef.current = controller;
        setStartingSession(true);
        setSessionError(null);
        try {
            const resp = await fetch(`${WebHelper.ApiAddress}/session/${id}/start`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
            });

            // 401 = session cookie expired; 400 is also returned by this backend
            // when the auth cookie is missing or invalid — either way the user
            // needs to re-authenticate. Deliberately don't strip `?game=` here:
            // once re-authenticated, MainApp remounts fresh and its lazy
            // useState re-reads the still-present param, retrying automatically.
            if (resp.status === 401 || resp.status === 400) {
                onAuthRequired?.();
                return;
            }

            if (!resp.ok) {
                // Only strip a bookmarked/linked `?game=` when the id itself is
                // invalid or forbidden — leave it alone on a transient/5xx
                // failure so a plain reload can retry once the backend recovers.
                if (resp.status === 404 || resp.status === 403) removeUrlParam('game');
                // The server says why (e.g. "This game no longer exists.") — show that.
                const body = await resp.json?.().catch(() => null);
                throw new Error(body?.error || `Session start failed (${resp.status})`);
            }
            const { centralSessionId: csId, centralAccessToken } = await resp.json();

            // Store the Central Server access token so WebRTCManager can use it
            // for signaling — obtained via the GM backend (same-origin, no CORS)
            if (centralAccessToken) {
                TokenStore.setTokens(centralAccessToken, TokenStore.getRefreshToken());
            }

            setCentralSessionId(csId);
            setGameID(id);
            // Keep the address bar in sync with "which game am I in" so a plain
            // reload re-enters the same game instead of requiring another click.
            setUrlParam('game', id);
        } catch (e) {
            if (e.name === 'AbortError') return; // user cancelled — not a real failure
            console.error('MainApp: Session start failed:', e);
            setSessionError(e.message);
        } finally {
            setStartingSession(false);
        }
    }, [onAuthRequired]);

    const handleCancelStarting = useCallback(() => {
        startAbortRef.current?.abort();
        removeUrlParam('game');
        setStartingSession(false);
    }, []);

    // Auto-join: if the URL already carries a `?game=` id (either a shared
    // deep link or one we wrote ourselves via setUrlParam above on a previous
    // visit), kick off the exact same flow a manual GameList click would.
    // The ref guard is belt-and-suspenders against handleGameSelected's
    // identity changing (it depends on onAuthRequired, which GMApp.js passes
    // as a new inline arrow on every render) ever causing a second auto-fire,
    // and future-proofs against StrictMode being added later.
    useEffect(() => {
        if (!autoGameId || autoJoinAttemptedRef.current) return;
        autoJoinAttemptedRef.current = true;
        handleGameSelected(autoGameId);
    }, [autoGameId, handleGameSelected]);

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
        removeUrlParam('game');
    }, []);

    if (startingSession) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '1rem' }}>
                Starting session…
                <button onClick={handleCancelStarting}>Cancel</button>
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
