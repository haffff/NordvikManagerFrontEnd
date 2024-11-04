import React, { Component } from 'react';
import WebHelper from '../../helpers/WebHelper';
class WebSocketManager {
    WebSocketReady = false;
    WebSocketStarted = false;
    WebSocket = undefined;
    IsGM = false;

    _onMessageEvents = [];

    Subscribe(name, method)
    {
        if(this._onMessageEvents.filter(x=>x.name === name).length > 0)
        {
            return;
        }
        this._onMessageEvents.push({name: name, method: method});
    }

    Unsubscribe(name)
    {
        this._onMessageEvents = this._onMessageEvents.filter(x=>x.name !== name);
    }

    ClearSubscription()
    {
        this._onMessageEvents = [];
    }

    constructor() {
    }

    Close() {
        this.WebSocketReady = false;
        this.WebSocketStarted = false;
        this.WebSocket.close();
        this.WebSocket = undefined;
    }

    Send(command) {
        if (this.WebSocketReady)
            this.WebSocket.send(JSON.stringify(command));
    }

    Start(GameID) {
        console.log("WebSocket: Started connecting with id: " + GameID);
        this.WebSocketStarted = true;
        if(this.WebSocket !== undefined)
        {
            return;
        }

        let ws = new WebSocket(WebHelper.WebSocketAddress);
        this.WebSocket = ws;
        
        this.WebSocket.onopen = (event) => {
            console.log("WebSocket: OnOpen  ");
            this.WebSocket.send(GameID);
            this.WebSocket.onclose = (event) => {
                console.error("Websocket: Closed, reason - " + event);
            }

            this.WebSocket.onmessage = (event) => {
                if (!this.WebSocketReady) {
                    if (event.data === "OK")
                    {
                        console.log("WebSocket: WebSocket is ready");
                        this.WebSocketReady = true;
                    }
                    return;
                }
                
                this._onMessageEvents.forEach(element => {
                    element.method(JSON.parse(event.data));
                });
            }
        }
    }
}

const WebSocketManagerInstance = new WebSocketManager();
export default WebSocketManagerInstance;
