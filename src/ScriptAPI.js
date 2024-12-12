import ClientMediator from "./ClientMediator";
import WebSocketManagerInstance from "./components/game/WebSocketManager";
import CommandExecutionHelper from "./helpers/CommandExecutionHelper";
import UtilityHelper from "./helpers/UtilityHelper";

class ScriptApi {
  _id = UtilityHelper.GenerateUUID();

  ClientMediator = {
    sendCommand: (command, data, additionalArgs) => {
      return ClientMediator.sendCommand(command, data, additionalArgs);
    },
    sendCommandAsync: (command, data, additionalArgs) => {
      return ClientMediator.sendCommandAsync(command, data, additionalArgs);
    },
    register: (client) => {
      return ClientMediator.register(client);
    },
  };
  
  RunCommand = (commandString) => CommandExecutionHelper.RunCommand(commandString);

  SendCustomCommandToServer(command, data, additionalArgs) {
    WebSocketManagerInstance.Send({
      command: command,
      data: data,
      ...additionalArgs,
    });
  }

  SubscribeWebSocket(callback) {
    const subscription = UtilityHelper.GenerateUUID();
    WebSocketManagerInstance.Subscribe(this._id + "_" + subscription, callback);
  }
}

export default () => new ScriptApi;
