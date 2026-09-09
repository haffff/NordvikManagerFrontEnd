import ClientMediator from "../ClientMediator";
import WebHelperDefault from "./WebHelper";
import { ActiveWebHelper } from "./transport";

// Coerces a raw string token value the way the Run dialog does: "true"/"false"
// become booleans, numeric strings become numbers, everything else stays a string.
const coerceArgValue = (v) => {
  if (v === "true" || v === "false") return v === "true";
  if (!isNaN(v) && v !== "") return v.indexOf(".") === -1 ? parseInt(v) : parseFloat(v);
  return v;
};

/**
 * Parses argument tokens (already split on whitespace) into a plain args object.
 * Supports "--name=value" flags and bare positional tokens; positional tokens are
 * named from `metaArgs` ($meta arg list) by index, falling back to "value".
 *
 * Shared by RunCommand and KeyboardEventsManager so a bound command string like
 * "Playlist.PlaySound --resourceId=abc" dispatches with identical arg parsing to
 * the same command typed into the Run dialog.
 */
export const parseArgTokens = (tokens, metaArgs = [], startPositionalIndex = 0) => {
  let positionalIndex = startPositionalIndex;
  const argsObj = {};
  for (const token of tokens) {
    if (!token) continue;
    let name;
    let value;
    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      name = eq === -1 ? token.slice(2) : token.slice(2, eq);
      value = eq === -1 ? undefined : token.slice(eq + 1);
    } else {
      name = metaArgs[positionalIndex]?.name ?? "value";
      positionalIndex++;
      value = token;
    }
    if (value === undefined || value === "") continue;
    argsObj[name] = coerceArgValue(value);
  }
  return argsObj;
};

/**
 * Splits a full command string ("Panel.Command --flag=x positional") into its
 * panel, command and parsed args object. Used where there is no matched
 * suggestion to supply $meta (e.g. firing a saved keyboard binding before the
 * Run dialog has ever populated the suggestion index).
 */
export const parseCommandString = (commandString, metaArgs = []) => {
  const parts = String(commandString ?? "").trim().split(/\s+/).filter(Boolean);
  const [panel, command] = (parts[0] ?? "").split(".");
  const args = parseArgTokens(parts.slice(1), metaArgs);
  return { panel, command, args };
};

export const CommandExecutionHelper = {
  _aliases: [],
  _suggestions: [],
  _descriptions: {
    "SetSelectedLayer": "Required --layerId",
    "SetLayerEditMode": "Makes layers above transparent. Required --layer",
    "SetOperationMode": "Required --mode",
    "SetArguments": "Required --value",
    "SetPopup": "Shows a popup with some html content. Required --content",
  },

  AddCommand: (alias, command, withArgs = false) => {
    CommandExecutionHelper._aliases.push({ alias, command, withArgs });
  },  RunCommand: async (commandString) => {
    //split by spaces
    let parts = commandString.trim().split(/\s+/);
    let fullCommand = parts[0];
    let args = parts.slice(1).filter(Boolean);

    //check for alias
    let alias = CommandExecutionHelper._aliases.find(
      (x) => x.alias === fullCommand
    );

    if (alias) {
      if (alias.withArgs) {
        let finalAlias = alias.command.split(" ");
        fullCommand = finalAlias[0];
        args = finalAlias.slice(1);
      } else {
        fullCommand = alias.command;
      }
    }

    //split command by dot. first part is panel, rest is command
    let commandParts = fullCommand.split(".");
    let panel = commandParts[0];
    let command = commandParts[1];

    let matchingSuggestion = CommandExecutionHelper._suggestions.find(
      (x) => x.panel === panel && x.command === command
    );    if (!matchingSuggestion) return undefined;

    let context = undefined;

    if (matchingSuggestion.requiresContext) {
      // Lazy-fetch — only paid when the command actually needs a context
      const openedBattleMaps = ClientMediator.sendCommand('Game', 'GetOpenedBattleMaps') ?? [];

      if (openedBattleMaps.length === 1) {
        // Only one BattleMap open — use it automatically, don't consume an arg
        context = openedBattleMaps[0].id ?? openedBattleMaps[0].Id;      } else {
        // Multiple open — first positional arg must identify which one.
        // Resolve map names once up-front (one sendCommand call per context).
        const contextMaps = openedBattleMaps.map((x) => ({
          ctx: x,
          map: ClientMediator.sendCommand('BattleMap', 'GetSelectedMap', { contextId: x.id ?? x.Id }),
        }));

        // Accept: full context UUID  OR  the loaded map's name (case-insensitive).
        const possibleContext = args[0]?.toLowerCase();
        const found = contextMaps.find(
          ({ ctx, map }) =>
            (ctx.id ?? ctx.Id) === args[0] ||
            map?.name?.toLowerCase() === possibleContext
        );
        if (!found) {
          if (openedBattleMaps.length === 0) return 'No BattleMap is open.';
          const labels = contextMaps.map(({ ctx, map }) => map?.name ?? (ctx.id ?? ctx.Id)).join(', ');
          return `Context required. Open maps: ${labels}`;
        }
        context = found.ctx.id ?? found.ctx.Id;
        args = args.slice(1); // consume the context token
      }
    }// Map positional index so we can look up the $meta arg name.
    // The synthetic 'context' arg is first in suggestion.args when requiresContext,
    // but it was already consumed above — so start the index at 1 to skip it.
    const metaArgs = matchingSuggestion.args ?? [];
    // The synthetic 'context' arg occupies positional slot 0 when requiresContext,
    // but it was already consumed above — start naming real positionals at index 1.
    const startPositionalIndex = matchingSuggestion.requiresContext ? 1 : 0;

    const argsObj = parseArgTokens(args, metaArgs, startPositionalIndex);

    return ClientMediator.sendCommandAsync(panel, command, {
      ...argsObj,
      contextId: context,
      isCommand: true,
    });
  },
  GetCommandDescription: (command) => {
    return CommandExecutionHelper._descriptions[command];
  },

  /**
   * Returns live value completions for a specific arg based on its semantic type.
   * Types recognised:
   *   bmcontext  → open BattleMap contexts  { value: Id, label: name }
   *   mapid      → all maps from server     { value: id, label: name }
   *   gameid     → current game id          { value: id, label: id }
   *   playerid   → all players              { value: id, label: name }
   *   resourceid      → all materials       { value: id, label: name }
   *   audioresourceid → materials whose MIME type is audio/*
   *   playlistid      → music playlists     { value: id, label: name }
   * Returns [] for unknown / plain types.
   */  GetArgCompletions: async (argType) => {
    switch (argType) {      case 'bmcontext': {
        const contexts = ClientMediator.sendCommand('Game', 'GetOpenedBattleMaps') ?? [];
        return contexts.map((ctx) => {
          const ctxId = ctx.id ?? ctx.Id ?? '';
          const map = ClientMediator.sendCommand('BattleMap', 'GetSelectedMap', { contextId: ctxId });
          const label = map?.name ? `${map.name} (${ctxId.slice(0, 8)}…)` : ctxId;
          return { value: ctxId, label };
        });
      }
      case 'mapid': {
        const maps = await ClientMediator.sendCommandAsync('Game', 'GetMaps') ?? [];
        return maps.map((m) => ({ value: m.id ?? m.Id, label: m.name ?? m.id }));
      }
      case 'layoutid': {
        const layouts = await WebHelperDefault.getAsync('Battlemap/GetLayouts') ?? [];
        return layouts.map((l) => ({ value: l.id, label: l.name ?? l.id }));
      }
      case 'gameid': {
        const id = ClientMediator.sendCommand('Game', 'GetGameId');
        return id ? [{ value: id, label: id }] : [];
      }
      case 'playerid': {
        const players = ClientMediator.sendCommand('Game', 'GetPlayers') ?? [];
        return players.map((p) => ({ value: p.id ?? p.Id, label: p.name ?? p.id }));
      }
      case 'resourceid':
      case 'audioresourceid': {
        // Materials carry a `mimeType` ("image/png", "audio/mpeg", …), but filesystem-linked
        // files can come back with mimeType "None" (the backend only classifies a handful of
        // extensions), so also sniff the file name / path for an audio extension.
        const resources = await ActiveWebHelper.getAsync('materials/getresources');
        if (!Array.isArray(resources)) {
          console.warn('[GetArgCompletions] materials/getresources returned', resources);
          return [];
        }
        const AUDIO_EXT = /\.(mp3|wav|ogg|oga|opus|m4a|m4b|aac|flac|weba|aiff?|wma)$/i;
        const isAudio = (r) =>
          (r.mimeType ?? r.MimeType ?? '').toLowerCase().startsWith('audio') ||
          AUDIO_EXT.test(r.name ?? r.Name ?? '') ||
          AUDIO_EXT.test(r.path ?? r.Path ?? '');
        const audioOnly = argType === 'audioresourceid';
        const out = resources
          .filter((r) => !audioOnly || isAudio(r))
          .map((r) => ({ value: r.id ?? r.Id, label: r.name ?? r.id ?? r.Id }));
        if (out.length === 0 && resources.length > 0) {
          console.info(`[GetArgCompletions] ${argType}: ${resources.length} material(s), none detected as audio.`,
            resources.map((r) => ({ name: r.name ?? r.Name, mimeType: r.mimeType ?? r.MimeType, storage: r.storage ?? r.Storage })));
        }
        return out;
      }
      case 'playlistid': {
        const playlists = await ClientMediator.sendCommandAsync('Playlist', 'GetPlaylists', { kind: 0 }) ?? [];
        return playlists.map((p) => ({ value: p.id ?? p.Id, label: p.name ?? p.id ?? p.Id }));
      }
      default:
        return [];
    }
  },
  GetSuggestions: (text) => {
    if (!text) return [];
    const lower = text.toLowerCase();
    return CommandExecutionHelper._suggestions.filter((x) =>
      x._lc_full.startsWith(lower) ||
      x._lc_panel.startsWith(lower) ||
      x._lc_command.startsWith(lower)
    );
  },
  LoadSuggestions: () => {
    const suggestions = [];
    // O(1) dedup: "panel\0command" key so we never add the same command twice
    // (multiple registered clients for the same panel share commands)
    const seen = new Set();

    const objectProtoKeys = new Set(Object.getOwnPropertyNames(Object.getPrototypeOf(Object)));

    for (const panel of Object.keys(ClientMediator._clientsHashSet)) {
      const bucket = ClientMediator._clientsHashSet[panel];
      for (const clientId of Object.keys(bucket)) {
        const clientObj = bucket[clientId];
        const requiresContext = !!clientObj.contextId;

        // Own instance properties + prototype methods (skip Object.prototype builtins)
        const proto = Object.getPrototypeOf(clientObj);
        const commands = [
          ...Object.getOwnPropertyNames(clientObj),
          ...Object.getOwnPropertyNames(proto).filter((k) => !objectProtoKeys.has(k)),
        ];

        for (const command of commands) {
          if (command.startsWith('_') || command === '$meta') continue;

          const dedupKey = `${panel}\0${command}`;
          if (seen.has(dedupKey)) continue;

          const func = clientObj[command];
          if (typeof func !== 'function') continue;

          seen.add(dedupKey);

          const meta = clientObj.$meta?.[command];
          const contextArg = requiresContext
            ? [{ name: 'context', type: 'bmcontext', required: true }]
            : [];
          const lcPanel = panel.toLowerCase();
          const lcCommand = command.toLowerCase();
          suggestions.push({
            panel,
            command,
            requiresContext,
            description: meta?.description ?? CommandExecutionHelper._descriptions[command] ?? '',
            args: requiresContext ? [...contextArg, ...(meta?.args ?? [])] : (meta?.args ?? []),
            // Pre-lowercased strings for fast GetSuggestions filtering
            _lc_panel: lcPanel,
            _lc_command: lcCommand,
            _lc_full: `${lcPanel}.${lcCommand}`,
          });
        }
      }
    }

    CommandExecutionHelper._suggestions = suggestions;
    return suggestions;
  },
};

export default CommandExecutionHelper;
