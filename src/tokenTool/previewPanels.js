import ClientMediator from "../ClientMediator";
import { ActiveTransportManager } from "../helpers/transport";

// What TokenManager and the game's token overlays (quick edit, icon picker) ask the game
// for, answered by the token editor (see the T0 spike): property values (the editor's
// sample values), the map's grid and selection, the game and whether the viewer is a GM
// (masks). Clicks on a token's parts would run actions or open panels; here they become
// a log line. Properties the overlays write come back as sample values.

export const PREVIEW_IDS = Object.freeze({
  token: "preview-token",
  card: "preview-card",
  map: "preview-map",
  game: "preview-game",
});

const SOURCES = {
  [PREVIEW_IDS.token]: ["element", "ElementModel"],
  [PREVIEW_IDS.card]: ["card", "CardModel"],
  [PREVIEW_IDS.map]: ["map", "MapModel"],
  [PREVIEW_IDS.game]: ["game", "GameModel"],
};

const describe = (data) => (data === undefined ? "" : ` ${JSON.stringify(data)}`);

/**
 * @param get        () => { values: { card, element, map, game }: name → string, gridSize, isGM }
 * @param onEvent    (line) => void — what a click on a part would do
 * @param onProperty (source, name, value) => void — a property an overlay wrote
 * @returns { dispose, select(token | null) } — select tells the overlays what is selected
 */
export function registerPreviewPanels({ get, onEvent, onProperty = () => {} }) {
  const selectionWatchers = new Map(); // name → method
  const panels = [
    {
      id: "token-editor-properties",
      panel: "Properties",
      GetByNames: async ({ parentId, names }) => {
        const [source, entityName] = SOURCES[parentId] ?? [];
        const values = source ? get().values?.[source] ?? {} : {};
        return (names ?? [])
          .filter((name) => values[name] !== undefined)
          .map((name) => ({ id: `${parentId}-${name}`, parentId, name, value: values[name], entityName }));
      },
    },
    {
      id: "token-editor-battlemap",
      panel: "BattleMap",
      // The overlays address the map by its id.
      contextId: PREVIEW_IDS.map,
      GetSelectedMap: () => ({ id: PREVIEW_IDS.map, gridSize: get().gridSize }),
      GetSelectedMapID: () => PREVIEW_IDS.map,
      // Truthy: an undefined answer makes the caller wait for another BattleMap.
      SubscribeSelectionChanged: ({ name, method }) => {
        selectionWatchers.set(name, method);
        return true;
      },
      UnSubscribeSelectionChanged: ({ name }) => {
        selectionWatchers.delete(name);
        return true;
      },
    },
    {
      id: "token-editor-action",
      panel: "Action",
      Run: ({ name, args }) => onEvent(`Runs the action ${name}${describe(args)}`),
    },
  ];

  // Game: the three answers TokenManager needs; any other command (CreateNewPanel, ...)
  // is something a click asked for.
  const game = { id: "token-editor-game", panel: "Game" };
  const gameAnswers = {
    GetGameId: () => PREVIEW_IDS.game,
    GetIsGM: () => !!get().isGM,
    GetCanEditGame: () => !!get().isGM,
  };
  panels.push(new Proxy(game, {
    get: (target, key) =>
      key in target ? target[key]
        : typeof key !== "string" ? undefined
        : gameAnswers[key] ?? ((data) => onEvent(`Game.${key}${describe(data)}`)),
  }));

  panels.forEach((client) => ClientMediator.register(client));

  // property_add / property_update for the token or its card, as the overlays send them.
  const stopWatching = ActiveTransportManager.watch?.((cmd) => {
    if (cmd?.command !== "property_update" && cmd?.command !== "property_add") return;
    const { parentId, name, value } = cmd.data ?? {};
    const [source] = SOURCES[parentId] ?? [];
    // Property values are text, as in a game (the icon picker writes a boolean).
    if (source && name) onProperty(source, name, value == null ? "" : String(value));
  });

  return {
    select(token) {
      const event = { selected: token ? [token] : [] };
      for (const method of [...selectionWatchers.values()]) method(event);
    },
    dispose() {
      stopWatching?.();
      selectionWatchers.clear();
      panels.forEach((client) => ClientMediator.unregister(client.id));
    },
  };
}
