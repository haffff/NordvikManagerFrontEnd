import ClientMediator from "../../ClientMediator";
import CentralWebHelper from "../../helpers/CentralWebHelper";
// NOT ActiveWebHelper: this endpoint is account-level, proxied to Central by the
// Backend — not in-game data. Routing it over the WebRTC tunnel (ActiveWebHelper)
// means WebRTCInProcessDispatcher fabricates a cookie-less HttpContext per request
// (see its DispatchAsync — only Content-Type/Content-Length headers are set), so
// UserController's CentralToken()/CentralRefreshToken cookie reads are always
// empty and every call 401s regardless of token freshness. Plain WebHelper hits
// the Backend's real HTTP endpoint with the browser's actual cookies attached —
// the same pattern GMApp.js already uses for this class of call.
import WebHelper from "../../helpers/WebHelper";

const IS_PLAYER_MODE = process.env.REACT_APP_MODE === 'player';

// Built-in shortcut catalog. Values are plain {panel, command} descriptors
// (not closures) so they can be merged 1:1 with the same-shaped bindings
// a user saves to the server — see GetKeyboardConfigFromCentralServer.
export const DefaultShortCuts = {
  // open command panel
  "Shift+P": { panel: "game", command: "OpenRun", label: "Open Run Dialog" },

  // Group selected elements
  "Shift+G": { panel: "battlemap", command: "GroupSelected", label: "Group Selected" },
  "Shift+U": { panel: "battlemap", command: "UngroupSelected", label: "Ungroup Selected" },
  "Ctrl+C": { panel: "battlemap", command: "CopyElements", label: "Copy Selected" },
  "Ctrl+V": { panel: "battlemap", command: "PasteElements", label: "Paste Elements" },
  "DELETE": { panel: "battlemap", command: "RemoveSelected", label: "Delete Selected" },
};

// Matches the format accepted by the Central/Backend KeyboardBindings endpoints.
// Order must match CreateActionName's emission order (Ctrl, Shift, Alt) below —
// a Ctrl+Alt+Shift ordering here would silently reject triple-modifier combos.
export const KEY_COMBO_REGEX = /^(Ctrl\+)?(Shift\+)?(Alt\+)?(.|HOME|DELETE|INSERT|PAGEUP|END|PAGEDOWN|BACKSPACE)$/;
// Empty string is a tombstone: it unbinds a default's key without assigning
// it to a new command (needed when a default action is rebound elsewhere —
// the default's original key must stop firing it, not just gain a sibling).
const COMMAND_REGEX = /^[A-Za-z_][\w-]*\.[A-Za-z_][\w-]*$/;
export const isValidBindingValue = (value) => value === "" || COMMAND_REGEX.test(value);

// Shared with KeyComboRecorder so the UI records combos in exactly the format
// the dispatcher matches against.
export function CreateActionName(ev) {
  let actionName = "";
  actionName += ev.ctrlKey ? "Ctrl+" : "";
  actionName += ev.shiftKey ? "Shift+" : "";
  actionName += ev.altKey ? "Alt+" : "";
  actionName += ev.key.toUpperCase();
  return actionName;
}

class KeyboardEventsManager {
  // ClientMediator identity — registered once by useGameInitialization so any
  // code (addons, other panels, a shortcuts cheat-sheet UI) can trigger a
  // shortcut exactly as if the user had pressed it, via
  // ClientMediator.sendCommandAsync("Keyboard", "Fire", { actionName: "Ctrl+C" }).
  panel = "Keyboard";
  id = "KeyboardEventsManager";
  $meta = {
    Fire: {
      description: 'Fires the action currently bound to a key combo (e.g. "Ctrl+C"), exactly as if that key had been pressed — resolves contextId the same way a real keypress does.',
      args: [{ name: 'actionName', type: 'string', required: true }],
    },
  };

  KeyboardMap = {};
  ShortCuts = { ...DefaultShortCuts };

  constructor() {
    this.KeyboardMap = {};
    this.HandleKeyboardEventDown.bind(this);
    this.HandleKeyboardEventUp.bind(this);
  }

  // Accepts either a bare actionName string (direct calls) or { actionName }
  // (CommandExecutionHelper wraps positional Run-dialog args into { [metaArgName]: value }).
  Fire(actionNameOrObj) {
    const actionName = typeof actionNameOrObj === "string" ? actionNameOrObj : actionNameOrObj?.actionName;
    return this.FireKeyboardEvent(actionName);
  }

  HandleKeyboardEventDown(ev) {
    if (ev.target.matches("input") || ev.target.matches("textarea")) return;
    this.KeyboardMap[ev.key] = true;
  }

  HandleKeyboardEventUp(ev) {
    if (ev.target.matches("input") || ev.target.matches("textarea")) return;
    let actionName = CreateActionName(ev);
    if (this.ShortCuts[actionName] !== undefined) {
      ev.preventDefault();
      this.FireKeyboardEvent(actionName);
    }
    this.KeyboardMap[ev.key] = false;
  }

  async FireKeyboardEvent(actionName) {
    const entry = this.ShortCuts[actionName];
    if (entry === undefined) return;

    const data = {};
    if (entry.panel.toLowerCase() === "battlemap") {
      data.contextId = await ClientMediator.sendCommandWaitForRegisterAsync(
        "Game",
        "GetActiveBattleMapId"
      );
    }

    ClientMediator.sendCommandAsync(entry.panel, entry.command, data);
  }

  async GetKeyboardConfigFromCentralServer() {
    const bindings = await fetchSavedBindings();
    this.ShortCuts = mergeShortcuts(bindings);
  }
}
export default KeyboardEventsManager;

export async function fetchSavedBindings() {
  const helper = IS_PLAYER_MODE ? CentralWebHelper : WebHelper;
  return await helper.getAsync("user/KeyboardBindings");
}

// Both CentralWebHelper.postAsync and WebHelper.postAsync resolve to a real
// fetch Response (`.ok`) — unlike WebRTCWebHelper, which resolves {status, body}.
export async function saveBindings(bindings) {
  const helper = IS_PLAYER_MODE ? CentralWebHelper : WebHelper;
  const resp = await helper.postAsync("user/KeyboardBindings", bindings);
  return { ok: !!resp?.ok };
}

// Merges the user's saved key-combo -> "panel.command" overrides onto the
// built-in defaults. Only the deltas live server-side, so un-remapped
// defaults must keep working. Shared with KeyboardShortcutsPanel so the UI
// computes "what key is this action on right now" the same way the
// dispatcher does.
export function mergeShortcuts(bindings) {
  const merged = { ...DefaultShortCuts };
  if (!bindings) return merged;

  for (const [key, value] of Object.entries(bindings)) {
    if (!KEY_COMBO_REGEX.test(key) || !isValidBindingValue(value)) {
      console.warn(`[KeyboardEventsManager] ignoring invalid saved binding: ${key} -> ${value}`);
      continue;
    }
    if (value === "") {
      delete merged[key];
      continue;
    }
    const [panel, command] = value.split(".");
    merged[key] = { panel, command };
  }
  return merged;
}
