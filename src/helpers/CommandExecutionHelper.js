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
  },

  RunCommand: (commandString) => {
    let openedBattleMaps = ClientMediator.sendCommand(
      "game",
      "GetOpenedBattleMaps"
    );
    console.log(openedBattleMaps);

    //split by spaces
    let parts = commandString.split(" ");
    let fullCommand = parts[0];
    let args = parts.slice(1);

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
    );
    if (matchingSuggestion) {
      let context = undefined;

      if (matchingSuggestion.requiresContext) {
        let possibleContext = args[0];
        context = openedBattleMaps.find(
          (x) =>
            x?.Id === possibleContext ||
            x?.name?.toLowerCase() === possibleContext?.toLowerCase()
        )?.Id;
        if (!context) return "Context not found";
        args = args.slice(1);
      }

      args = args.map((x) => {
        if (x.startsWith("--")) {
          let parts = x.split("=");
          return { name: parts[0].substring(2), value: parts[1] };
        } else {
          return x;
        }
      });

      let argsObj = {};
      args.forEach((x) => {
        if (typeof x === "string") {
          argsObj["value"] = x;
        } else {
          if (x.value) {
            if (x.value === "true" || x.value === "false") {
              x.value = x.value === "true";
            } else if (!isNaN(x.value)) {
              //if its int then parse int
              if (x.value.indexOf(".") === -1) {
                x.value = parseInt(x.value);
              } else {
                x.value = parseFloat(x.value);
              }
            }

            argsObj[x.name] = x.value;
          }
        }
      });
      return ClientMediator.sendCommandAsync(panel, command, {
        ...argsObj,
        contextId: context,
        isCommand: true,
      });
    }
  },

  GetCommandDescription: (command) => {
    return CommandExecutionHelper._descriptions[command];
  },

  GetSuggestions: (text) => {
    if (!text) {
      return [];
    }
    text = text.toLowerCase();
    let suggestions = CommandExecutionHelper._suggestions.filter(
      (x) =>
        x?.command?.toLowerCase().startsWith(text) ||
        x?.panel?.toLowerCase().startsWith(text) ||
        (x?.panel.toLowerCase() + "." + x?.command.toLowerCase()).startsWith(
          text
        )
    );
    return suggestions;
  },

  LoadSuggestions: (command) => {
    let suggestions = [];

    //get all panels
    let panels = Object.keys(ClientMediator._clientsHashSet);
    //get all commands
    panels.forEach((panel) => {
      let clients = Object.keys(ClientMediator._clientsHashSet[panel]);
      clients.forEach((client) => {
        const clientObj = ClientMediator._clientsHashSet[panel][client];
        const contextId = clientObj.contextId;
        let commands = Object.getOwnPropertyNames(clientObj);

        const prototype = Object.getPrototypeOf(clientObj);
        const objectPrototype = Object.getPrototypeOf(Object);
        let prototypeCommands = Object.getOwnPropertyNames(prototype).filter(
          (x) => objectPrototype[x] === undefined
        );

        commands = commands.concat(prototypeCommands);

        commands.forEach((command) => {
          let func = ClientMediator._clientsHashSet[panel][client][command];
          if (
            command.startsWith("_") === false &&
            typeof func === "function" &&
            !suggestions.find((x) => x.panel === panel && x.command === command)
          ) {
            suggestions.push({
              panel,
              command,
              requiresContext: contextId ? true : false,
              //params,
            });
          }
        });
      });
    });

    CommandExecutionHelper._suggestions = suggestions;
    return suggestions;
  },
};

export default CommandExecutionHelper;
