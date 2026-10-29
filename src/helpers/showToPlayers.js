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

// Same type and the same serializable props (in any key order).
const sameAs = (a, b) => a?.type === b?.type && (a.type === "Battlemap"
  ? a.syncId === b.syncId
  : stableJson(a.props) === stableJson(b.props));

export const stableJson = (value) => JSON.stringify(value ?? {}, (key, val) =>
  val && typeof val === "object" && !Array.isArray(val)
    ? Object.fromEntries(Object.keys(val).sort().map((k) => [k, val[k]]))
    : val);

/**
 * The open panel (and tab) already showing what show_panel describes, so a player who still has
 * it gets it brought forward instead of a second copy; null when it isn't open.
 */
export function findOpenPanel(dockState, wanted, battleMaps, resolveKey) {
  if (!dockState) return null;
  const stack = [dockState.rootPanel, ...(dockState.floatingPanels ?? [])].filter(Boolean);
  while (stack.length) {
    const panel = stack.pop();
    const tabIndex = (panel.contentList ?? []).findIndex((content) =>
      sameAs(panelForPlayers(content, battleMaps, resolveKey) ?? describe(content, resolveKey), wanted));
    if (tabIndex !== -1) return { panel, tabIndex };
    stack.push(...(panel.splitPanels ?? []));
  }
  return null;
}

// Any panel's description (not only player panels): a player may have opened it themselves.
function describe(content, resolveKey) {
  const element = content?.element;
  const type = element ? resolveKey(element.type) : undefined;
  return type ? { type, props: LayoutHelper.SerializableProps(element.props) } : null;
}
