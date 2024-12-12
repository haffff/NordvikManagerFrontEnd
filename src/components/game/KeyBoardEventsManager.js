import ClientMediator from "../../ClientMediator";

class KeyboardEventsManager {
    _getSelectedBattleMapContext = undefined;

    KeyboardMap = {};
    ShortCuts = {
        "Shift+P": (operationManager) => {
            ClientMediator.sendCommand("Game", "OpenRun");
        },
        "Shift+G": (operationManager) => {
            operationManager.GroupSelected();
        },
        "Shift+U": (operationManager) => {
            operationManager.UngroupSelected();
        },
        "Ctrl+C": (operationManager) => {
            operationManager.CopyElements();
        },
        "Ctrl+V": (operationManager) => {
            operationManager.PasteElements();
        },
        "DELETE": (operationManager) => {
            operationManager.RemoveSelected();
        }
    }

    constructor() {
        this.KeyboardMap = {};
        this.HandleKeyboardEventDown.bind(this);
        this.HandleKeyboardEventUp.bind(this);
    }

    HandleKeyboardEventDown(ev) {
        if(ev.target.matches("input") || ev.target.matches("textarea")) return;
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
        if(ev.target.matches("input") || ev.target.matches("textarea")) return;
        let actionName = this.CreateActionName(ev);
        console.log(actionName);
        console.log(this.ShortCuts[actionName]);
        let action = this.ShortCuts[actionName];
        if (action !== undefined) {
            ev.preventDefault();
            //if (this._getSelectedBattleMapContext !== undefined) {
                //let ctx = this._getSelectedBattleMapContext();
                //if(ctx !== undefined)
                    action();
            //}
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
