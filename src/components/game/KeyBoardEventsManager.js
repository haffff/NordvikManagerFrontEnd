class KeyboardEventsManager {
    _getSelectedBattleMapContext = undefined;

    KeyboardMap = {};
    ShortCuts = {
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
        let actionName = this.CreateActionName(ev);
        console.log(actionName);
        let action = this.ShortCuts[actionName];
        if (action !== undefined) {
            ev.preventDefault();
            if (this._getSelectedBattleMapContext !== undefined) {
                let ctx = this._getSelectedBattleMapContext();
                if(ctx !== undefined)
                    action(ctx.current.BattleMapServices.BMService);
            }
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
