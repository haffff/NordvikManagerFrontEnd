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
        console.log("Sent command: " + command + " to panel: " + panel);
        console.log(data);

        let clients = this._clientsHashSet[panel.toLowerCase()];

        if (!clients) {
            return undefined;
        }

        if (data && data.contextId) {
            clients = Object.values(clients).filter(x => x.contextId === data.contextId);
        }

        if (Object.values(clients).length === 1) {
            return Object.values(clients)[0][command](data);
        }
        else {
            let results = Object.values(clients).map(client => {
                if (client[command]) {
                    return client[command](data);
                }
            });

            results = results.filter(x => x !== undefined);

            if(results.length === 1)
            {
                return results[0];
            }

            return results;
        }
    },

    sendCommandAsync: async function (panel, command, data, waitUntilAvailable = false) {
        console.log("Sent async command: " + command + " to panel: " + panel);
        console.log(data);

        return new Promise((resolve, reject) => {
            let found = false;

            let result = this.sendCommand(panel, command, data);
            if (result !== undefined) {
                resolve(result);
            }
            else if (waitUntilAvailable) {
                console.log("Awaiting async command: " + command + " to panel: " + panel);
                if (this._awaitingRequests.find(x => x.panel.toLowerCase() === panel.toLowerCase() && x.command === command && x.uniqueKey === data.uniqueKey)) {
                    reject("Request already pending.");
                }
                this._awaitingRequests.push({ panel, command, uniqueKey: data.uniqueKey, data, resolve, reject });
            }
            else {
                reject("Client not found.");
            }
        });
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
        }
        else {
            this._clientsHashSet[clientPanel][clientId] = client;
        }

        if (this._awaitingRequests.length > 0) {
            let requests = this._awaitingRequests.filter(x => clientPanel === toString(x.panel) && (x.contextId === client.contextId || !x.contextId));
            requests.forEach(request => {
                let result = client[request.command](request.data);
                if (result !== undefined) {
                    request.resolve(result);
                    let index = this._awaitingRequests.indexOf(request);
                    if (index > -1) {
                        this._awaitingRequests.splice(index, 1);
                    }
                }
            });
        }

        console.log("Registered client: " + client.id + " for panel: " + client.panel);
    },

    unregister: function (id) {
        Object.values(this._clientsHashSet).forEach(panel => {
            if (panel[id]) {
                delete panel[id];
            }
        });
    },

    fireEvent: function (eventName, data) {
        Object.values(this._clientsHashSet).forEach(clients => {
            Object.values(clients).forEach(client => {
                if (client.onEvent) {
                    client.onEvent(eventName, data);
                }
            });
        });
    }
};

export default ClientMediator;