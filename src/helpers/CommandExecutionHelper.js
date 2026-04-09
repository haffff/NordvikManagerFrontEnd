import ClientMediator from "../ClientMediator";

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
        context = openedBattleMaps[0].Id;      } else {
        // Multiple open — first positional arg must identify which one.
        // Resolve map names once up-front (one sendCommand call per context).
        const contextMaps = openedBattleMaps.map((x) => ({
          ctx: x,
          map: ClientMediator.sendCommand('BattleMap', 'GetSelectedMap', { contextId: x.Id }),
        }));

        // Accept: full context UUID  OR  the loaded map's name (case-insensitive).
        const possibleContext = args[0]?.toLowerCase();
        const found = contextMaps.find(
          ({ ctx, map }) =>
            ctx.Id === args[0] ||
            map?.name?.toLowerCase() === possibleContext
        );
        if (!found) {
          if (openedBattleMaps.length === 0) return 'No BattleMap is open.';
          const labels = contextMaps.map(({ ctx, map }) => map?.name ?? ctx.Id).join(', ');
          return `Context required. Open maps: ${labels}`;
        }
        context = found.ctx.Id;
        args = args.slice(1); // consume the context token
      }
    }// Map positional index so we can look up the $meta arg name.
    // The synthetic 'context' arg is first in suggestion.args when requiresContext,
    // but it was already consumed above — so start the index at 1 to skip it.
    const metaArgs = matchingSuggestion.args ?? [];
    let positionalIndex = matchingSuggestion.requiresContext ? 1 : 0;

    args = args.map((x) => {
      if (x.startsWith("--")) {
        let parts = x.split("=");
        return { name: parts[0].substring(2), value: parts[1] };
      } else {
        // Use the $meta arg name for this position if available, else fall back to "value"
        const argName = metaArgs[positionalIndex]?.name ?? "value";
        positionalIndex++;
        return { name: argName, value: x };
      }
    });

    let argsObj = {};
    args.forEach((x) => {
      if (x.value !== undefined && x.value !== "") {
        let v = x.value;
        if (v === "true" || v === "false") {
          v = v === "true";
        } else if (!isNaN(v) && v !== "") {
          v = v.indexOf(".") === -1 ? parseInt(v) : parseFloat(v);
        }
        argsObj[x.name] = v;
      }
    });

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
   * Returns [] for unknown / plain types.
   */  GetArgCompletions: async (argType) => {
    switch (argType) {      case 'bmcontext': {
        const contexts = ClientMediator.sendCommand('Game', 'GetOpenedBattleMaps') ?? [];
        return contexts.map((ctx) => {
          const map = ClientMediator.sendCommand('BattleMap', 'GetSelectedMap', { contextId: ctx.Id });
          const label = map?.name ? `${map.name} (${ctx.Id.slice(0, 8)}…)` : ctx.Id;
          return { value: ctx.Id, label };
        });
      }
      case 'mapid': {
        const maps = await ClientMediator.sendCommandAsync('Game', 'GetMaps') ?? [];
        return maps.map((m) => ({ value: m.id ?? m.Id, label: m.name ?? m.id }));
      }
      case 'layoutid': {
        const WebHelper = require('./WebHelper').default;
        const layouts = await WebHelper.getAsync('Battlemap/GetLayouts') ?? [];
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
