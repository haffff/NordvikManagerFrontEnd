export const ClientMediator = {
  /*
    ClientHashset structure
    {
        Panel1: {
            client1id: { command1 : function, command2 : function },
            client2id: { command1 : function, command2 : function }
        }
    }
    */
  _clientsHashSet: {},
  _awaitingRequests: [],

  sendCommand: function (panel, command, data) {
    let clients = this._clientsHashSet[panel.toLowerCase()];

    if (!clients) {
      return undefined;
    }

    if (data && data.contextId) {
      clients = Object.values(clients).filter(
        (x) => x.contextId === data.contextId
      );
    }

    if (Object.values(clients).length === 1) {
      //try return command
      try {
        return Object.values(clients)[0][command](data);
      } catch (e) {
        throw new Error(
          "Command not found: " +
            command +
            " for panel: " +
            panel +
            " with data: " +
            JSON.stringify(data)
        );
      }
    } else {
      let results = Object.values(clients).map((client) => {
        if (client[command]) {
          return client[command](data);
        }
      });

      results = results.filter((x) => x !== undefined);

      if (results.length === 1) {
        return results[0];
      }

      return results;
    }
  },

  sendCommandWaitForRegister: async function (
    panel,
    command,
    data,
    waitUntilAvailable = false
  ) {
    return new Promise((resolve, reject) => {
      let found = false;

      let result = this.sendCommand(panel, command, data);
      if (result !== undefined) {
        resolve(result);
      } else if (waitUntilAvailable) {
        console.log("List of awaiting requests:", this._awaitingRequests);
        this._awaitingRequests.push({
          panel,
          command,
          uniqueKey: data.uniqueKey,
          data,
          resolve,
          reject,
        });
      } else {
        reject("Client not found.");
      }
    });
  },

  sendCommandWaitForRegisterAsync: async function (
    panel,
    command,
    data,
    waitUntilAvailable = false
  ) {
    let found = false;

    let result = await this.sendCommandAsync(panel, command, data);
    if (result !== undefined) {
      return result;
    } else if (waitUntilAvailable) {
      console.log("Awaiting async command: " + command + " to panel: " + panel);
      if (
        this._awaitingRequests.find(
          (x) =>
            x.panel.toLowerCase() === panel.toLowerCase() &&
            x.command === command &&
            x.uniqueKey === data.uniqueKey
        )
      ) {
        console.warn("Request already pending.");
        return undefined;
      }

      return new Promise((resolve, reject) => {
        console.log("List of awaiting requests:", this._awaitingRequests);
        this._awaitingRequests.push({
          panel,
          command,
          uniqueKey: data.uniqueKey,
          data,
          resolve,
          reject,
        });
      });
    } else {
      console.warn("Client not found.");
      return undefined;
    }
  },

  sendCommandAsync: async function (panel, command, data) {
    let clients = this._clientsHashSet[panel.toLowerCase()];

    if (!clients) {
      return undefined;
    }

    if (data && data.contextId) {
      clients = Object.values(clients).filter(
        (x) => x.contextId === data.contextId
      );
    }

    if (Object.values(clients).length === 1) {
      try {
        return await Object.values(clients)[0][command](data);
      } catch (e) {
        throw new Error(
          "Command not found: " +
            command +
            " for panel: " +
            panel +
            " with data: " +
            JSON.stringify(data)
        );
      }
    } else {
      let results = await Promise.all(
        Object.values(clients).map(async (client) => {
          if (client[command]) {
            return await client[command](data);
          }
        })
      );

      results = results.filter((x) => x !== undefined);

      if (results.length === 1) {
        return results[0];
      }

      return results;
    }
  },

  register: function (client) {
    let clientPanel = client.panel.toLowerCase();
    let clientId = client.id;

    if (!this._clientsHashSet[clientPanel]) {
      this._clientsHashSet[clientPanel] = {};
    }
    if (this._clientsHashSet[clientPanel][clientId]) {
      console.warn("Client with id " + clientId + " already registered.");
      return;
    } else {
      this._clientsHashSet[clientPanel][clientId] = client;
    }

    this.checkAwaitingAndExecute();

    console.log(
      "Registered client: " + client.id + " for panel: " + client.panel
    );
  },

  checkAwaitingAndExecute: async function () {
    if (this._awaitingRequests.length > 0) {
      let r = await Promise.all(this._awaitingRequests.map( async (request) => {
        try {
            let result = await this.sendCommandAsync(request.panel, request.command, request.data);
            console.log("Request resolved: ", request.panel, request.command);
            console.log("Awaiting requests: ", this._awaitingRequests);

            request.resolve(result);
            this._awaitingRequests = this._awaitingRequests.filter(x => x !== request);
        } catch (e)
        {

        }
      }));
    }
  },

  unregister: function (id) {
    Object.values(this._clientsHashSet).forEach((panel) => {
      if (panel[id]) {
        delete panel[id];
      }
    });
  },

  fireEvent: function (eventName, data) {
    Object.values(this._clientsHashSet).forEach((clients) => {
      Object.values(clients).forEach((client) => {
        if (client.onEvent) {
          client.onEvent(eventName, data);
        }
      });
    });
  },
};

export default ClientMediator;
