import React, { useState, useEffect, useCallback } from 'react';
import GameList from './gameLobby/GameList';
import { Game } from './game/Game';
import WebHelper from '../helpers/WebHelper';
import FabricTypesInitialize from './FabricTypesInitializer';
import WebSocketManagerInstance from './game/WebSocketManager';

export const MainApp = () => {
    const [gameID, setGameID] = useState();

    // Initialize fabric types once on mount
    useEffect(() => {
        FabricTypesInitialize();
        
        // Cleanup function for when component unmounts
        return () => {
            console.log('MainApp: Component unmounting, cleaning up');
            if (WebSocketManagerInstance.isConnected()) {
                WebSocketManagerInstance.Close();
            }
        };
    }, []);

    // Memoize logout handler to prevent unnecessary re-renders
    const handleLogout = useCallback(() => {
        WebHelper.getNoResp("user/logout", () => {
            // Force page reload to clear all state and cookies
            window.location.reload();
        }, (error) => {
            console.error('Logout failed:', error);
            // Still reload on error to clear potential stale state
            window.location.reload();
        });
    }, []);

    // Memoize exit handler with better cleanup
    const handleExit = useCallback(() => {
        console.log('MainApp: Exiting game, cleaning up WebSocket connection');
        
        try {
            if (WebSocketManagerInstance.isConnected()) {
                console.log(`MainApp: Closing WebSocket (${WebSocketManagerInstance.getSubscriberCount()} subscribers)`);
                WebSocketManagerInstance.Close();
            }
        } catch (error) {
            console.error('MainApp: Error closing WebSocket:', error);
        }
        
        setGameID(undefined);
    }, []);

    if (gameID === undefined) {
        return (
            <GameList 
                OnSuccess={setGameID} 
                OnLogout={handleLogout} 
            />
        );
    }

    // TODO: Add illustrator for costs
    return (
        <Game 
            key={gameID} 
            onExit={handleExit} 
            gameID={gameID} 
        />
    );
}
export default MainApp;