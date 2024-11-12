import WebSocketManagerInstance from "./components/game/WebSocketManager";

export const CardAPI = {
  _propertySubscriptions: {},

  Load: () => {
    WebSocketManagerInstance.Subscribe('CardAPI', (command) => {
        if(command.command.startsWith("property"))
        {
            if(command.command === "property_update")
            {
                if(CardAPI._propertySubscriptions[command.data.id])
                {
                    CardAPI._propertySubscriptions[command.data.id].forEach(callback => {
                        callback(command.data);
                    });
                }
            }

            if(command.command === "property_remove")
            {
                if(CardAPI._propertySubscriptions[command.data])
                {
                    CardAPI._propertySubscriptions[command.data].forEach(callback => {
                        callback(undefined);
                    });
                }
            }
        }
    });
  },

  Properties: {
    Get: (propertyName) => {},
    GetMany: (propertyNames) => {},
    GetById: (propertyId) => {},
    Update: (propertyName, value) => {
    },
    UpdateMany: (properties) => {},
    Add: (propertyName, value) => {},
    AddMany: (properties) => {},
    Remove: (propertyName) => {},

    CreateManagedProperty: (propertyId) => {
        this._propertySubscriptions[propertyId] = this._propertySubscriptions[propertyId] || [];
        const managedProperty = {
            Get: () => {},
            Update: (value) => {},
            Remove: () => {},
            Subscribe: (callback) => {
                this._propertySubscriptions[propertyId].push(callback);
            },
            Unsubscribe: (callback) => {
                this._propertySubscriptions[propertyId] = this._propertySubscriptions[propertyId].filter(x => x !== callback);
            }
        };

        return managedProperty;
        }
    },

  GetBattleMaps: () => {},

  SendChatMessage: (message) => {},

  FireAction: (action, args) => {},

  SendCustomCommandToServer: (command, data, additionalArgs) => {},

  SpellFunctions: {
    RunSpellFunction: (propertyName, args) => {},
  },
};
