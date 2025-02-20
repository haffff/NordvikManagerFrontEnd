import ClientMediator from "../../ClientMediator";

class KeyboardEventsManager {
  KeyboardMap = {};
  ShortCuts = {
    "Shift+P": (contextId) => {
      ClientMediator.sendCommand("Game", "OpenRun");
    },
    "Shift+G": (contextId) => {
    },
    "Shift+U": (contextId) => {
    },
    "Ctrl+C": (contextId) => {
    },
    "Ctrl+V": (contextId) => {
    },
    "DELETE": (contextId) => {
    },
  };

  constructor() {
    this.KeyboardMap = {};
    this.HandleKeyboardEventDown.bind(this);
    this.HandleKeyboardEventUp.bind(this);
  }

  HandleKeyboardEventDown(ev) {
    if (ev.target.matches("input") || ev.target.matches("textarea")) return;
    this.KeyboardMap[ev.key] = true;
    console.log(this.KeyboardMap[ev.key]);
  }

  FireKeyboardEvent(actionName) {
    let action = this.ShortCuts[actionName];
    if (action !== undefined) {
      action();
    }
  }

  HandleKeyboardEventUp(ev) {
    if (ev.target.matches("input") || ev.target.matches("textarea")) return;
    let actionName = this.CreateActionName(ev);
    console.log(actionName);
    console.log(this.ShortCuts[actionName]);
    let action = this.ShortCuts[actionName];
    if (action !== undefined) {
      ev.preventDefault();
      action();
    }
    this.KeyboardMap[ev.key] = false;

    console.log(this.KeyboardMap[ev.key]);
  }

  CreateActionName(ev) {
    let actionName = "";
    actionName += ev.ctrlKey ? "Ctrl+" : "";
    actionName += ev.shiftKey ? "Shift+" : "";
    actionName += ev.altKey ? "Alt+" : "";
    actionName += ev.key.toUpperCase();
    return actionName;
  }
}
export default KeyboardEventsManager;
