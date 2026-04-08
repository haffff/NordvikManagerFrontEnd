import * as React from 'react';
import GameDataManger from '../GameDataManager';
import KeyboardEventsManager from '../KeyBoardEventsManager';

/**
 * Owns all game state, refs, and stable callbacks that are shared between hooks.
 * Pass the returned object directly to useGameEventHandlers and useGameInitialization.
 */
export const useGameState = (gameID, onExit) => {
  // --- State ---
  const [battleMapContexts, setBattleMapContexts] = React.useState({});
  const [portaledPanels, setPortaledPanels] = React.useState([]);
  const [selectedBattleMapId, setSelectedBattleMapId] = React.useState(undefined);
  const [players, setPlayers] = React.useState([]);
  const [connectedPlayers, setConnectedPlayers] = React.useState([]);
  const [currentPlayerId, setCurrentPlayerId] = React.useState(undefined);
  const [layout, setLayout] = React.useState(undefined);
  const [isGM, setIsGM] = React.useState(false);
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  // --- Refs ---
  const playersRef = React.useRef(players);
  playersRef.current = players;

  const connectedPlayersRef = React.useRef(connectedPlayers);
  connectedPlayersRef.current = connectedPlayers;

  const battleMapsContextsRef = React.useRef({});
  battleMapsContextsRef.current = battleMapContexts;
  const gameContainerRef = React.useRef(null);
  const quickCommandDialogOpenRef = React.useRef(null);  // Holds the player object fetched at init — used by useGameApi without causing re-renders
  const currentPlayerRef = React.useRef(null);
  // Holds the full game object fetched at init
  const gameRef = React.useRef(null);
  const gameDataManagerRef = React.useRef(new GameDataManger());
  const keyboardEventsManagerRef = React.useRef(new KeyboardEventsManager());

  // --- Stable callbacks ---
  const UpdateAfterTime = React.useCallback(() => {
    setTimeout(forceUpdate, 100);
  }, []);

  return {
    // Identity
    gameID,
    onExit,
    // State values
    battleMapContexts,
    portaledPanels,
    selectedBattleMapId,
    players,
    connectedPlayers,
    currentPlayerId,
    layout,
    // State setters
    setBattleMapContexts,
    setPortaledPanels,
    setSelectedBattleMapId,
    setPlayers,
    setConnectedPlayers,
    setCurrentPlayerId,
    setLayout,
    isGM,
    setIsGM,
    forceUpdate,
    // Refs
    playersRef,
    connectedPlayersRef,
    battleMapsContextsRef,    gameContainerRef,
    quickCommandDialogOpenRef,
    currentPlayerRef,
    gameRef,
    gameDataManagerRef,
    keyboardEventsManagerRef,
    // Callbacks
    UpdateAfterTime,
  };
};
