import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import { ActiveTransportManager } from "../../helpers/transport";
import { getPanelKeyForComponent } from "../../helpers/PanelsList";
import { usePermissions } from "../../contexts/PermissionsContext";
import DockableHelper from "../../helpers/DockableHelper";
import { showToPlayersItems } from "../../helpers/showToPlayers";

// The game's dock. Each panel's ⋯ menu also offers GMs "Show to players" (see showToPlayers),
// e.g. to give a player back a card or the battle map they closed by mistake.
export default function GameDock({ state, dockModifier, battleMaps }) {
  const { canEditGame } = usePermissions();
  const battleMapsRef = React.useRef(battleMaps);
  battleMapsRef.current = battleMaps;

  const menuItems = React.useCallback((content) => showToPlayersItems(content, {
    canEditGame,
    battleMaps: battleMapsRef.current,
    resolveKey: getPanelKeyForComponent,
    send: (command) => ActiveTransportManager.Send(command),
  }), [canEditGame]);

  return (
    <Dockable.Container state={state} dockModifier={dockModifier} onPopOut={DockableHelper.getPopOutHandler()} menuItems={menuItems} />
  );
}
