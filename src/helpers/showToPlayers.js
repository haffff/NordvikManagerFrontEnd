// "Show to players" in a panel's ⋯ menu: a GM opens the same panel for every other player,
// e.g. when one closed a card or the battle map by mistake. It uses the server's show_panel
// command (only for players who can edit the game; the others get it as a floating panel,
// see useGameEventHandlers.HandleShowPanel), with the panel described like a saved layout's.
import { LayoutHelper } from "./LayoutCloneHelper";

// Panels a player can use. The rest (settings, addon tools, admin) are the GM's.
export const PLAYER_PANELS = new Set([
  "Battlemap",
  "CardPanel",
  "CardsPanel",
  "ChatPanel",
  "DiceRollerPanel",
  "MaterialsPanel",
  "PlayersPanel",
  "PropertiesPanel",
  "ToolsPanel",
  "TurnOrderPanel",
]);

/**
 * The show_panel description of a dock content ({ type, props } or, for a battle map,
 * { type: "Battlemap", syncId }), or null when it isn't a panel for players.
 */
export function panelForPlayers(content, battleMaps, resolveKey) {
  const element = content?.element;
  const type = element ? resolveKey(element.type) : undefined;
  if (!type || !PLAYER_PANELS.has(type)) return null;

  if (type === "Battlemap") {
    // As the battle map's own "Show" does: players open the battle map with that sync id.
    const battleMap = Object.values(battleMaps ?? {}).find((bm) => bm?.PanelContentID === content.contentId);
    return battleMap?.id ? { type, syncId: battleMap.id } : null;
  }
  return { type, props: LayoutHelper.SerializableProps(element.props) };
}

/** The Container's menuItems for one panel: "Show to players" for GMs, when it applies. */
export function showToPlayersItems(content, { canEditGame, battleMaps, resolveKey, send }) {
  if (!canEditGame) return [];
  const panel = panelForPlayers(content, battleMaps, resolveKey);
  if (!panel) return [];
  return [{ label: "Show to players", onClick: () => send({ command: "show_panel", data: panel }) }];
}
