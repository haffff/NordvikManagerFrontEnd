import * as React from "react";
import { ActiveWebHelper as WebHelper, ActiveTransportManager as WebSocketManagerInstance } from "../../helpers/transport";
import * as Dockable from "@hlorenzi/react-dockable";
import MainToolbar from "./ToolBar/MainToolbar";
import Subscribable from "../uiComponents/base/Subscribable";
import { Flex, Box, Text } from "@chakra-ui/react";
import { CloseButton } from "../ui/close-button";
import PanelList from "../../helpers/PanelsList";
import QuickCommandDialog from "../QuickCommandDialog";
import { LoadingScreen } from "../uiComponents/LoadingScreen";
import WebSocketStatus from "../uiComponents/WebSocketStatus";
import { useGameEventHandlers } from "./hooks/useGameEventHandlers";
import { useGameInitialization } from "./hooks/useGameInitialization";
import { useGameApi } from "./hooks/useGameApi";
import { useGameState } from "./hooks/useGameState";
import DockableHelper from "../../helpers/DockableHelper";
import { DragOptimizationProvider } from "../uiComponents/base/DragOptimizationContext";

export const Game = ({ gameID, onExit }) => {
  const gameState = useGameState(gameID, onExit);  
  const {
    battleMapContexts,
    portaledPanels,
    clientScripts,
    gameContainerRef,
    quickCommandDialogOpenRef,
    gameDataManagerRef,
    keyboardEventsManagerRef,
    forceUpdate,
  } = gameState;

  WebHelper.GameId = gameID;
  // Setting up dockable. when dockable is loading we start websocketManagerInstance
  const state = Dockable.useDockable();

  // Set the global dockable state for other components to access drag state
  React.useEffect(() => {
    DockableHelper.setGlobalState(state);
  }, [state]);

  // Layout and element creation - memoized to prevent unnecessary re-renders
  const CreateLayoutElement = React.useCallback((content) => {
    const props = {
      ...content.props,
      gameDataManagerRef,
      state,
      keyboardEventsManagerRef,
      syncId: content.syncId || content.props?.syncId || undefined,
      withID: content.syncId,
    };

    // Tolerant lookup: try exact match, then case-insensitive, then substring match to handle memo/wrapper names
    let resolvedType = undefined;
    if (content && content.type) {
      if (PanelList[content.type]) {
        resolvedType = content.type;
      } else {
        // Try case-insensitive exact match
        const ciMatch = Object.keys(PanelList).find((k) => k.toLowerCase() === String(content.type).toLowerCase());
        if (ciMatch) {
          resolvedType = ciMatch;
        } else {
          // Try substring match (e.g., 'Memo(Battlemap)')
          const subMatch = Object.keys(PanelList).find((k) => String(content.type).toLowerCase().includes(k.toLowerCase()));
          if (subMatch) {
            resolvedType = subMatch;
            console.warn(`CreateLayoutElement: mapped saved panel type '${content.type}' to '${resolvedType}'`);
          }
        }
      }
    }

    if (!resolvedType) {
      console.error(`Panel type ${content.type} is not defined`);
      return React.createElement('div', { className: 'unknown-panel', 'data-panel-type': content.type }, `Unknown panel: ${content.type}`);
    }

    return React.createElement(PanelList[resolvedType], props);
  }, [gameDataManagerRef, state, keyboardEventsManagerRef]);
  // Register the Game ClientMediator API — re-runs when state/closures change
  useGameApi({ state, gameState, CreateLayoutElement });

  const [connectionError, setConnectionError] = React.useState(null);

  // Initialize custom hooks
  const eventHandlers = useGameEventHandlers({ state, gameState, CreateLayoutElement });
  const { loadGame, initError, clearInitError, isInitialized } = useGameInitialization({ state, gameState, CreateLayoutElement });// Game initialization effect - only run once when WebSocket is ready
  React.useEffect(() => {
    if (!WebSocketManagerInstance.WebSocketStarted || isInitialized()) {
      return;
    }

    const initializeGame = async () => {
      try {
        await loadGame();
      } catch (error) {
        console.error('Failed to initialize game:', error);
      }
    };

    initializeGame();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [WebSocketManagerInstance.WebSocketStarted]); // Only depend on WebSocket status

  if (!WebSocketManagerInstance.WebSocketStarted) {
    WebSocketManagerInstance.Start(gameID, (err) => setConnectionError(err?.message || 'Connection error'));
    return <LoadingScreen />;
  }  //To refactor toolbar. it will be in Toolbar directory probably. but i need to make map system and write tools panel properly.
  return (
    <DragOptimizationProvider>
      <div
        ref={gameContainerRef}
        style={{
          display: "grid",
          gridTemplateRows: "35px calc(100vh - 35px - 60px)", // Subtract status bar height (60px)
          height: "100vh",
          overflow: "hidden"
        }}
        onKeyDown={(e) =>
          keyboardEventsManagerRef.current.HandleKeyboardEventDown(e)
        }
        onKeyUp={(e) => keyboardEventsManagerRef.current.HandleKeyboardEventUp(e)}
      ><Subscribable
        onMessage={eventHandlers.HandleShowLayout}
        commandPrefix={"layout_forcechange"}
      />
      <Subscribable
        onMessage={eventHandlers.HandleSettingsChange}
        commandPrefix={"settings"}
      />
      <Subscribable onMessage={eventHandlers.HandlePlayers} commandPrefix={"player"} />
      <Subscribable
        onMessage={eventHandlers.HandleExecuteClientScript}
        commandPrefix={"clientscript_execute"}
      />
      <Subscribable
        onMessage={eventHandlers.HandleShowBattleMap}
        commandPrefix={"battlemap_show"}
      />
      <Subscribable onMessage={eventHandlers.HandleError} commandPrefix={"error"} />
      <Subscribable onMessage={eventHandlers.HandleShowPanel} commandPrefix={"show_panel"} />
      <MainToolbar
        key={gameID}
        state={state}
        gameDataManagerRef={gameDataManagerRef}
        battlemapsRef={battleMapContexts}
        forceRefreshGame={forceUpdate}
      />      <Flex style={{ height: "100%", overflow: "hidden" }}>
        <Dockable.Container state={state} />
      </Flex><QuickCommandDialog state={state} openRef={quickCommandDialogOpenRef} />
      
      {portaledPanels}
      {clientScripts.map((x) => x.value)}
      
      {/* Error banner — shown above status bar when there is an error */}
      {(connectionError || initError) && (
        <Box
          position="fixed"
          bottom="60px"
          left={0}
          right={0}
          bg="red.900"
          borderTop="1px solid"
          borderColor="red.600"
          px={4}
          py={2}
          zIndex={9998}
        >
          <Flex align="center" gap={2}>
            <Text fontSize="xs" color="red.200" flex={1}>
              {connectionError || initError}
            </Text>
            <CloseButton
              size="sm"
              color="red.300"
              onClick={() => { setConnectionError(null); clearInitError(); }}
            />
          </Flex>
        </Box>
      )}

      {/* WebSocket Status Bar */}
      <Box
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        bg="rgba(26, 32, 44, 0.95)"
        backdropFilter="blur(12px)"
        borderTop="1px solid rgba(255, 255, 255, 0.08)"
        px={4}
        py={2}
        zIndex={9999}
        boxShadow="0 -2px 20px rgba(0, 0, 0, 0.3)"
      >
        <Flex justify="space-between" align="center">
          <WebSocketStatus showDetails={true} compact={true} />
          <Text fontSize="xs" color="gray.500">
            Game ID: {gameID}
          </Text>        </Flex>
      </Box>
    </div>
    </DragOptimizationProvider>
  );
};

export default Game;
