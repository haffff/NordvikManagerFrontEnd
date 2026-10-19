// The demo's stand-in for WebRTCManager: the same interface (Start/Close/Send/
// Subscribe/sendRaw...), but every request and command is answered in the browser by
// DemoServer instead of the GM backend. REST answers go through WebRTCWebHelper's
// normal path, so the rest of the app can't tell the difference.
//
// In demo builds, vite.config.js resolves src/helpers/transport.js to this file.

import WebRTCWebHelperInstance from '../helpers/WebRTCWebHelper';
import { DemoServer } from './DemoServer';

const later = (fn) => setTimeout(fn, 0);

export class DemoTransport {
  WebSocketStarted = false;
  WebSocketReady = false;
  IsGM = false;

  _subscribers = [];
  _server = new DemoServer(null);

  /** Swaps in a fixture (the GM's or the player's view). Takes effect for the next requests. */
  load(fixture, { onNote } = {}) {
    this._server = new DemoServer(fixture, { onNote });
  }

  Start() {
    if (this.WebSocketStarted) return;
    this.WebSocketStarted = true;
    this.WebSocketReady = true;
    WebRTCWebHelperInstance.setTransport(this);
    WebRTCWebHelperInstance.flushQueue();
  }

  Close() {
    WebRTCWebHelperInstance.reset();
    this.WebSocketStarted = false;
    this.WebSocketReady = false;
  }

  forceReconnect() {
    this.Close();
    this.Start();
  }

  Send(command) {
    if (!command) return false;
    this._deliver(this._server.command(command));
    return true;
  }

  // Used by WebRTCWebHelper for api-requests.
  sendRaw(message) {
    const { status, body, broadcasts } = this._server.request(message);
    later(() => {
      WebRTCWebHelperInstance.handleApiResponse({ id: message.id, status, body });
      this._deliver(broadcasts);
    });
    return Promise.resolve();
  }

  _deliver(messages) {
    if (!messages?.length) return;
    later(() => {
      for (const message of messages) {
        for (const { name, method } of [...this._subscribers]) {
          try { method(message); } catch (e) { console.error(`[Demo] subscriber ${name} error`, e); }
        }
      }
    });
  }

  Subscribe(name, method) {
    const existing = this._subscribers.find((s) => s.name === name);
    if (existing) existing.method = method;
    else this._subscribers.push({ name, method });
  }

  Unsubscribe(name) {
    this._subscribers = this._subscribers.filter((s) => s.name !== name);
  }

  ClearSubscription() {
    this._subscribers = [];
  }

  isConnected() { return this.WebSocketReady; }
  isChannelReady() { return this.WebSocketReady; }
  getConnectionState() {
    if (!this.WebSocketStarted) return 'DISCONNECTED';
    return this.WebSocketReady ? 'READY' : 'CONNECTING';
  }
  getQueuedMessageCount() { return 0; }
  getSubscriberCount() { return this._subscribers.length; }
}

// Same exports as src/helpers/transport.js.
export const ActiveWebHelper = WebRTCWebHelperInstance;
export const ActiveTransportManager = new DemoTransport();
