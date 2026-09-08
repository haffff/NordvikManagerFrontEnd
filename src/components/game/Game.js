import * as React from "react";
import { ActiveWebHelper as WebHelper, ActiveTransportManager as WebSocketManagerInstance } from "../../helpers/transport";
import * as Dockable from "@hlorenzi/react-dockable";
import MainToolbar from "./ToolBar/MainToolbar";
import Subscribable from "../uiComponents/base/Subscribable";
import { Flex, Box, Text, Button } from "@chakra-ui/react";
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
import { PermissionsProvider } from "../../contexts/PermissionsContext";
import PlaybackManager from "./PlaybackManager";

export const Game = ({ gameID, onExit, centralSessionId, onAuthFailure }) => {
  const gameState = useGameState(gameID, onExit);
  const {
    battleMapContexts,
    portaledPanels,
    gameContainerRef,
    quickCommandDialogOpenRef,
    gameDataManagerRef,
    keyboardEventsManagerRef,
    forceUpdate,
    isGM,
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
  const { loadGame, initError, clearInitError, resetInitialization, isInitialized } = useGameInitialization({ state, gameState, CreateLayoutElement });

  // Reset the module-level initialization flag on unmount so that re-entering the same
  // game (e.g. after being kicked and rejoining) triggers a fresh loadGame call.
  React.useEffect(() => {
    return () => { resetInitialization(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Game initialization effect - only run once when WebSocket is ready
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
    WebSocketManagerInstance.Start(
      centralSessionId,
      (err) => {
        if (err?.isAuthError) {
          onAuthFailure?.();
        } else {
          setConnectionError(err?.message || 'Connection error');
        }
      },
    );
    return <LoadingScreen />;
  }  //To refactor toolbar. it will be in Toolbar directory probably. but i need to make map system and write tools panel properly.
  return (
    <PermissionsProvider isGM={isGM}>
    <DragOptimizationProvider>
      <div
        ref={gameContainerRef}
        style={{
          display: "grid",
          gridTemplateRows: "35px 1fr auto",
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
      <Subscribable onMessage={eventHandlers.HandleError} commandPrefix={"error"} />
      <Subscribable onMessage={eventHandlers.HandleShowPanel} commandPrefix={"show_panel"} />
      <Subscribable onMessage={eventHandlers.HandleShowCard} commandPrefix={"show_card"} />
      <Subscribable onMessage={eventHandlers.HandleShowView} commandPrefix={"show_view"} />
      <Subscribable onMessage={eventHandlers.HandleViewShow} commandPrefix={"view_show"} />
      <Subscribable onMessage={eventHandlers.HandleAddMenuItem} commandPrefix={"menu_item_add"} />
      <Subscribable onMessage={eventHandlers.HandleAddToolbarButton} commandPrefix={"toolbar_button_add"} />
      <Subscribable onMessage={eventHandlers.HandleFireClientMediator} commandPrefix={"client_mediator_fire"} />
      <Subscribable onMessage={eventHandlers.HandleOperationProgress} commandPrefix={"operation_"} />
      <PlaybackManager />
      <MainToolbar
        key={gameID}
        state={state}
        gameDataManagerRef={gameDataManagerRef}
        battlemapsRef={battleMapContexts}
        forceRefreshGame={forceUpdate}
      />      <Flex style={{ height: "100%", overflow: "hidden" }}>
      <Dockable.Container state={state} onPopOut={DockableHelper.getPopOutHandler()} />
      </Flex><QuickCommandDialog state={state} openRef={quickCommandDialogOpenRef} />
      
      {portaledPanels}
      
      {/* WebSocket Status Bar */}
      <Box
        bg={connectionError || initError ? "red.950" : "rgba(26, 32, 44, 0.95)"}
        backdropFilter="blur(12px)"
        borderTop="1px solid"
        borderColor={connectionError || initError ? "red.700" : "rgba(255, 255, 255, 0.08)"}
        px={4}
        py={2}
        zIndex={9999}
        boxShadow="0 -2px 20px rgba(0, 0, 0, 0.3)"
      >
        <Flex justify="space-between" align="center" gap={2}>
          <WebSocketStatus showDetails={true} compact={true} />
          {(connectionError || initError) && (
            <Flex align="center" gap={2} flex={1} justify="center">
              <Text fontSize="xs" color="red.200">
                {connectionError || initError}
              </Text>
              <Button
                size="xs"
                colorPalette="blue"
                variant="outline"
                onClick={() => {
                  resetInitialization();
                  setConnectionError(null);
                  WebSocketManagerInstance.forceReconnect();
                  // forceReconnect() flips WebSocketStarted false→true synchronously
                  // (Close() then Start() in the same tick), so React never observes
                  // an intermediate value and the init effect below (which depends on
                  // that mutable field) never re-fires on its own. Call loadGame()
                  // directly instead of relying on the effect — requests it makes
                  // queue safely until the new data channel opens.
                  loadGame().catch((error) => console.error('Retry: failed to reload game:', error));
                }}
              >
                Retry
              </Button>
            </Flex>
          )}
          <Text fontSize="xs" color="gray.500">
            Session ID: {centralSessionId}
          </Text>
        </Flex>
      </Box>
    </div>
    </DragOptimizationProvider>
    </PermissionsProvider>
  );
};

export default Game;
