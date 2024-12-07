import ClientMediator from "./ClientMediator";
import WebSocketManagerInstance from "./components/game/WebSocketManager";
import UtilityHelper from "./helpers/UtilityHelper";
import WebHelper from "./helpers/WebHelper";

class CardAPI {
  _propertySubscriptions = {};
  _propertyCache = {};
  _cardId = null;

  _id = UtilityHelper.GenerateUUID();

  constructor(cardId) {
    this._cardId = cardId;

    WebSocketManagerInstance.Subscribe("CardAPI_" + this._id, (command) => {
      if (command.command.startsWith("property")) {
        if (command.command === "property_notify") {
          //Check if the command is for this card
          if (command.data.cardId !== this._cardId) {
            return;
          }

          this.GetMany(command.data.names).then((x) => {
            x.forEach((y) => {
              if (this._propertySubscriptions[y.name]) {
                this._propertySubscriptions[y.name].forEach((callback) => {
                  callback(y);
                });
              }
            });
          });
        }

        if (command.command === "property_add") {
          //Check if the command is for this card
          if (command.data.parentId !== this._cardId) {
            return;
          }

          if (this._propertySubscriptions[command.data.name]) {
            this._propertySubscriptions[command.data.name].forEach(
              (callback) => {
                callback(command.data);
              }
            );
          }
        }

        if (command.command === "property_update") {
          //Check if the command is for this card
          if (command.data.parentId !== this._cardId) {
            return;
          }

          if (this._propertySubscriptions[command.data.name]) {
            this._propertySubscriptions[command.data.name].forEach(
              (callback) => {
                callback(command.data);
              }
            );
          }
        }
      }
    });
  }

  async InitApi() {}

  destroy() {
    WebSocketManagerInstance.Unsubscribe("CardAPI_" + this._id);
  }

  Properties = {
    Init: async (propertyName, value) => {
      const propsFound = await ClientMediator.sendCommandAsync(
        "Properties",
        "GetByNames",
        {
          parentId: this._cardId,
          names: propertyName,
        }
      );

      if (propsFound.length === 0) {
        ClientMediator.sendCommandAsync("Properties", "Add", {
          property: {
            entityName: "CardModel",
            name: propertyName,
            value: value,
            parentId: this._cardId,
          },
        });
      }
    },
    InitMany: async (properties) => {
      const propsFound = await ClientMediator.sendCommandAsync(
        "Properties",
        "GetByNames",
        {
          parentId: this._cardId,
          names: properties.map((x) => x.name),
        }
      );

      const missingProps = properties.filter(
        (x) => !propsFound.find((y) => y.name === x.name)
      );

      missingProps.forEach((x) => {
        ClientMediator.sendCommandAsync("Properties", "Add", {
          property: {
            entityName: "CardModel",
            name: x.name,
            value: x.value,
            parentId: this._cardId,
          },
        });
      });
    },

    Get: async (propertyName) => {
      const result = await ClientMediator.sendCommandAsync("Properties", "GetByNames", {
        parentId: this._cardId,
        names: propertyName,
      });

      return result[0];
    },

    GetMany: async (propertyNames) => {
      const result =  await ClientMediator.sendCommandAsync("Properties", "GetByNames", {
        parentId: this._cardId,
        names: propertyNames,
      });

      return result;
    },

    Set: async (propertyName, value) => {
      let prop = await this.Properties.Get(propertyName);
      if (prop && prop.value === value) {
        return;
      }
      if (prop) {
        ClientMediator.sendCommandAsync("Properties", "Update", {
          property: {
            id: prop.id,
            name: propertyName,
            value: value,
            parentId: this._cardId,
            entityName: "CardModel",
          },
        });
      } else {
        ClientMediator.sendCommandAsync("Properties", "Add", {
          property: {
            name: propertyName,
            value: value,
            parentId: this._cardId,
            entityName: "CardModel",
          },
        });
      }
    },

    SetMany: async (properties) => {
      const propsFound = await ClientMediator.sendCommandAsync(
        "Properties",
        "GetByNames",
        {
          parentId: this._cardId,
          names: properties.map((x) => x.name),
        }
      );

      const propsToUpdate = propsFound.filter((x) => {
        const prop = properties.find((y) => y.name === x.name);
        return prop && prop.value !== x.value;
      });

      const propsToAdd = properties.filter(
        (x) => !propsFound.find((y) => y.name === x.name)
      );

      propsToUpdate.forEach((x) => {
        ClientMediator.sendCommandAsync("Properties", "Update", {
          property: {
            id: x.id,
            name: x.name,
            value: x.value,
            parentId: this._cardId,
            entityName: "CardModel",
          },
        });
      });

      propsToAdd.forEach((x) => {
        ClientMediator.sendCommandAsync("Properties", "Add", {
          property: {
            name: x.name,
            value: x.value,
            parentId: this._cardId,
            entityName: "CardModel",
          },
        });
      });
    },

    Remove: (propertyName) => {
      const prop = this.Properties.Get(propertyName);

      ClientMediator.sendCommandAsync("Properties", "Remove", {
        propertyId: prop.id,
      });
    },

    Subscribe: (propertyName, callback) => {
      if (!this._propertySubscriptions[propertyName]) {
        this._propertySubscriptions[propertyName] = [];
      }

      this._propertySubscriptions[propertyName].push(callback);
    },
    Unsubscribe: (propertyName, callback) => {
      if (this._propertySubscriptions[propertyName]) {
        const index =
          this._propertySubscriptions[propertyName].indexOf(callback);
        if (index !== -1) {
          this._propertySubscriptions[propertyName].splice(index, 1);
        }
      }
    },
  };

  GetBattleMaps() {}

  SendChatMessage(message) {
    WebSocketManagerInstance.Send({
      command: "chat_message",
      data: message,
    });
  }

  FireAction(action, args) {
    WebSocketManagerInstance.Send({
      command: "action_execute",
      data: {
        action: action,
        args: args,
      },
    });
  }

  SendCustomCommandToServer(command, data, additionalArgs) {
    WebSocketManagerInstance.Send({
      command: command,
      data: data,
      ...additionalArgs,
    });
  }

  SpellFunctions = {
    RunSpellFunction: (propertyName, args) => {},
  };
}

export default async (cardId) => {
  const api = new CardAPI(cardId);
  await api.InitApi();
  return api;
};
