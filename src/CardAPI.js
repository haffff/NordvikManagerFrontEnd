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
              this._propertyCache[y.name] = y;

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

          this._propertyCache[command.data.name] = command.data;

          if (this._propertySubscriptions[command.data.name]) {
            this._propertySubscriptions[command.data.name].forEach(
              (callback) => {
                callback(command.data);
              }
            );
          }
        }

        if (command.command === "property_update") {
          if (!command.data.name) {
            //find by id from cache
            let foundProp = this._propertyCache.find(
              (x) => x.id === command.data.id
            );

            command.data.name = foundProp.name;
          } else {
            let foundProp = this._propertyCache[command.data.name];
            if (foundProp.id !== command.data.id) {
              return;
            }
          }

          if (this._propertySubscriptions[command.data.name]) {
            this._propertySubscriptions[command.data.name].forEach(
              (callback) => {
                callback(command.data);
              }
            );
          }
        }

        if (command.command === "property_remove") {
          let foundProp = this._propertyCache.find(
            (x) => x.id === command.data
          );

          if (this._propertySubscriptions[foundProp.name]) {
            this._propertySubscriptions[foundProp.name].forEach((callback) => {
              callback(undefined);
            });
          }
        }
      }
    });
  }

  async InitApi() {
    const properties = await WebHelper.getAsync(
      "properties/QueryProperties?parentIds=" + this._cardId
    );
    properties.forEach((x) => {
      this._propertyCache[x.name] = x;
    });
    return properties;
  }

  destroy() {
    WebSocketManagerInstance.Unsubscribe("CardAPI_" + this._id);
  }

  Properties = {
    Init: (propertyName, value) => {
      this.Properties.Get(propertyName).then((x) => {
        if (!x) {
          WebSocketManagerInstance.Send({
            command: "property_add",
            data: {
              name: propertyName,
              value: value,
              parentId: this._cardId,
              entityName: "CardModel",
            },
          });
        }
      });
    },
    InitMany: (properties) => {
      this.Properties.GetMany(properties.map((x) => x.name)).then((x) => {
        const missingProperties = properties.filter(
          (x) => x.filter((y) => y.name === x.name).length === 0
        );
        WebHelper.post(
          "properties/AddBulk",
          missingProperties.map((x) => ({
            name: x.name,
            value: x.value,
            parentId: this._cardId,
            entityName: "CardModel",
          })),
          (response) => {
            WebSocketManagerInstance.Send({
              command: "property_notify",
              data: {
                cardId: this._cardId,
                names: missingProperties.map((x) => x.name),
              },
            });
          }
        );
      });
    },
    Get: (propertyName) => {
      return new Promise((resolve, reject) => {
        if (this._propertyCache[propertyName]) {
          resolve(this._propertyCache[propertyName]);
        } else {
          WebHelper.get(
            "properties/QueryProperties?names=" +
              propertyName +
              "&parentIds=" +
              this._cardId,

            (response) => {
              if (response.length === 0) {
                resolve(undefined);
              } else {
                this._propertyCache[propertyName] = response[0];
                resolve(response[0]);
              }
            },
            (error) => reject(error)
          );
        }
      });
    },
    GetMany: (propertyNames) => {
      return new Promise((resolve, reject) => {
        //Create 2 collections. found properties and missing ones
        const foundProperties = [];
        const missingProperties = [];
        propertyNames.forEach((x) => {
          if (this._propertyCache[x]) {
            foundProperties.push(this._propertyCache[x]);
          } else {
            missingProperties.push(x);
          }
        });

        if (missingProperties.length === 0) {
          resolve(foundProperties);
        }

        WebHelper.get(
          "properties/QueryProperties?names=" +
            missingProperties.join(",") +
            "&parentIds=" +
            this._cardId,
          (response) => {
            response.forEach((x) => {
              this._propertyCache[x.name] = x.value;
              foundProperties.push(x.value);
            });

            resolve(foundProperties);
          },
          (error) => reject(error)
        );
      });
    },

    Set: (propertyName, value) => {
      if (
        this._propertyCache[propertyName] &&
        this._propertyCache[propertyName].value === value
      ) {
        return;
      }

      //try to get the property
      this.Properties.Get(propertyName).then((x) => {
        if (x) {
          //update the property
          WebSocketManagerInstance.Send({
            command: "property_update",
            data: { id: x.id, name: propertyName, value: value },
          });
        } else {
          //create the property
          WebSocketManagerInstance.Send({
            command: "property_add",
            data: {
              name: propertyName,
              value: value,
              parentId: this._cardId,
              entityName: "CardModel",
            },
          });
        }
      });
    },

    SetMany: (properties) => {
      properties = properties.filter(
        (x) =>
          x.name &&
          x.value &&
          !(
            this._propertyCache[x.name] &&
            this._propertyCache[x.name].value === x.value
          )
      );
      //try to get the properties
      this.Properties.GetMany(properties.map((x) => x.name)).then((x) => {
        const existingProperties = x.filter((y) => y !== undefined);
        const missingProperties = x.filter((y) => y === undefined);

        //update existing properties
        existingProperties.forEach((x) => {
          const property = properties.find((y) => y.name === x.name);
          WebSocketManagerInstance.Send({
            command: "property_update",
            data: {
              id: x.id,
              name: x.name ?? undefined,
              value: property.value,
            },
          });
        });

        //create missing properties
        missingProperties.forEach((x) => {
          const property = properties.find((y) => y.name === x);
          WebSocketManagerInstance.Send({
            command: "property_add",
            data: {
              name: property.name,
              value: property.value,
              parentId: this._cardId,
              entityName: "CardModel",
            },
          });
        });
      });
    },

    Remove: (propertyName) => {
      this.Properties.Get(propertyName).then((x) => {
        if (x) {
          WebSocketManagerInstance.Send({
            command: "property_remove",
            data: x.id,
          });
        }
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
