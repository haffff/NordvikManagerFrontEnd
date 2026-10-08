import ClientMediator from "../../../ClientMediator";
import { ActiveWebHelper as WebHelper, ActiveTransportManager as Transport } from "../../../helpers/transport";

// The turn order of a map (one per map), reachable from anywhere through ClientMediator
// (panel "TurnOrder"): the Run dialog, shortcuts, addons, other panels. Changes go to
// the server as turnorder_* commands; after each, every client refetches what it may
// see (hidden entries are left out for players). Without a mapId, a command works on
// the map shown in the active battle map view. TurnOrderManager registers this.

/** The map shown in the active battle map view, or undefined. */
export async function activeMapId() {
  const battleMapId = await ClientMediator.sendCommandAsync("Game", "GetActiveBattleMapId");
  if (!battleMapId) return undefined;
  return ClientMediator.sendCommand("BattleMap", "GetSelectedMap", { contextId: battleMapId })?.id;
}

const send = async (command, data, mapId) => {
  const id = mapId ?? (await activeMapId());
  if (!id) return false;
  Transport.Send({ command, data: { mapId: id, ...data } });
  return true;
};

// Leaves out keys whose value is undefined, so messages stay minimal.
const defined = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));

const mapIdArg = { name: "mapId", type: "string", required: false };

export const TurnOrderService = {
  panel: "TurnOrder",
  id: "TurnOrderService",

  $meta: {
    GetState: {
      description: "Returns (async) the turn order of a map as this player may see it: { mapId, round, currentEntryId, currentHidden, canEndTurn, canEdit, entries: [{ id, name, initiative, elementId, hidden }] }.",
      args: [mapIdArg],
    },
    Add: {
      description: "Adds tokens (elementIds) and/or a free entry (name) to the turn order, with an optional initiative. GM only.",
      args: [mapIdArg, { name: "elementIds", type: "array", required: false }, { name: "name", type: "string", required: false }, { name: "initiative", type: "number", required: false }, { name: "hidden", type: "boolean", required: false }],
    },
    Remove: {
      description: "Removes entries (entryIds) or tokens' entries (elementIds). GM only.",
      args: [mapIdArg, { name: "entryIds", type: "array", required: false }, { name: "elementIds", type: "array", required: false }],
    },
    SetInitiative: {
      description: "Sets an entry's (entryId) or a token's (elementId) initiative; empty clears it. sort: true re-sorts afterwards. GM only.",
      args: [mapIdArg, { name: "entryId", type: "string", required: false }, { name: "elementId", type: "string", required: false }, { name: "initiative", type: "number", required: false }, { name: "sort", type: "boolean", required: false }],
    },
    SetHidden: {
      description: "Hides an entry from players, or shows it again. GM only.",
      args: [mapIdArg, { name: "entryId", type: "string", required: true }, { name: "hidden", type: "boolean", required: true }],
    },
    Reorder: {
      description: "Puts the entries in the given order (entryIds). GM only.",
      args: [mapIdArg, { name: "entryIds", type: "array", required: true }],
    },
    Sort: {
      description: "Sorts by initiative, highest first (ties keep their place). GM only.",
      args: [mapIdArg],
    },
    Next: {
      description: "Passes the turn to the next entry (after the last one, the next round starts). GM only.",
      args: [mapIdArg],
    },
    Previous: {
      description: "Gives the turn back to the previous entry. GM only.",
      args: [mapIdArg],
    },
    GoTo: {
      description: "Makes it this entry's turn. GM only.",
      args: [mapIdArg, { name: "entryId", type: "string", required: true }],
    },
    EndTurn: {
      description: "Ends the current turn: allowed for the GM and for the player controlling the current token.",
      args: [mapIdArg],
    },
    Reset: {
      description: "Starts again at round 1 with the first entry, or (clear: true) removes every entry. GM only.",
      args: [mapIdArg, { name: "clear", type: "boolean", required: false }],
    },
    Open: {
      description: "Opens the Turn order panel.",
      args: [],
    },
  },

  GetState: async ({ mapId } = {}) => {
    const id = mapId ?? (await activeMapId());
    if (!id) return null;
    return WebHelper.getAsync(`TurnOrder?mapId=${id}`);
  },

  Add: ({ mapId, elementIds, name, initiative, hidden } = {}) => {
    const entries = [
      ...(elementIds ?? []).map((elementId) => defined({ elementId, initiative, hidden })),
      ...(name ? [defined({ name, initiative, hidden })] : []),
    ];
    return send("turnorder_add", { entries }, mapId);
  },

  Remove: ({ mapId, entryIds, elementIds } = {}) => send("turnorder_remove", defined({ entryIds, elementIds }), mapId),

  SetInitiative: ({ mapId, entryId, elementId, initiative, sort } = {}) => {
    const empty = initiative === undefined || initiative === null || String(initiative).trim() === "";
    return send("turnorder_update", defined({
      entryId,
      elementId,
      initiative: empty ? undefined : Number(initiative),
      clearInitiative: empty ? true : undefined,
      sortAfter: !!sort,
    }), mapId);
  },

  SetHidden: ({ mapId, entryId, hidden } = {}) => send("turnorder_update", { entryId, hidden: !!hidden }, mapId),

  Reorder: ({ mapId, entryIds } = {}) => send("turnorder_reorder", { entryIds: entryIds ?? [] }, mapId),

  Sort: ({ mapId } = {}) => send("turnorder_sort", {}, mapId),

  Next: ({ mapId } = {}) => send("turnorder_advance", { direction: 1 }, mapId),

  Previous: ({ mapId } = {}) => send("turnorder_advance", { direction: -1 }, mapId),

  GoTo: ({ mapId, entryId } = {}) => send("turnorder_advance", { entryId }, mapId),

  EndTurn: ({ mapId } = {}) => send("turnorder_end_turn", {}, mapId),

  Reset: ({ mapId, clear } = {}) => send("turnorder_reset", { clear: !!clear }, mapId),

  Open: () => ClientMediator.sendCommand("Game", "CreateNewPanel", { type: "TurnOrderPanel", props: {} }),
};

export default TurnOrderService;
