import ClientMediator from "../../ClientMediator";
import { parseCommandString } from "../../helpers/CommandExecutionHelper";
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
//
// "panel.command" optionally followed by a space and an argument tail, e.g.
// "Playlist.PlaySound --resourceId=abc-123". Args are parsed by
// parseCommandString and merged into the dispatched payload by FireKeyboardEvent.
// Must stay in sync with KeyboardBindingCommandRegex (Backend UserController.cs)
// and KEYBOARD_BINDING_COMMAND_REGEX (Central routes/user.js).
const COMMAND_REGEX = /^[A-Za-z_][\w-]*\.[A-Za-z_][\w-]*(\s+\S.*)?$/;
// Mirrors MaxKeyboardBindingStringLength (Backend) / MAX_KEYBOARD_BINDING_STRING_LENGTH
// (Central). A binding value longer than this is rejected server-side, failing the
// whole save — the panel guards against it up front.
export const MAX_BINDING_VALUE_LENGTH = 256;
export const isValidBindingValue = (value) =>
  value === "" || (value.length <= MAX_BINDING_VALUE_LENGTH && COMMAND_REGEX.test(value));

// While a KeyComboRecorder is actively capturing a combo, the game container's
// onKeyUp still bubbles here (the recorder lives inside that div and the manager
// is wired via React synthetic events, not a document listener). Without this
// gate, recording e.g. "Ctrl+C" in the shortcuts panel also fires whatever
// "Ctrl+C" is bound to. KeyComboRecorder toggles this around its capture window.
let comboRecordingActive = false;
export const setComboRecording = (active) => { comboRecordingActive = !!active; };
export const isComboRecording = () => comboRecordingActive;

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
    if (comboRecordingActive) return;
    if (ev.target.matches("input") || ev.target.matches("textarea")) return;
    this.KeyboardMap[ev.key] = true;
  }

  HandleKeyboardEventUp(ev) {
    if (comboRecordingActive) return;
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

    // Args parsed from the saved binding string (e.g. "--resourceId=abc") are the
    // dispatch payload's base; contextId is layered on top for battlemap commands.
    const data = { ...(entry.args ?? {}) };
    if (entry.panel?.toLowerCase() === "battlemap") {
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

// Merges the user's saved key-combo -> "panel.command [args]" overrides onto the
// built-in defaults. Only the deltas live server-side, so un-remapped
// defaults must keep working. Shared with KeyboardShortcutsPanel so the UI
// computes "what key is this action on right now" the same way the
// dispatcher does. Each merged entry is { panel, command, args } — args is the
// parsed argument object (empty when the binding has no argument tail).
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
    const { panel, command, args } = parseCommandString(value);
    merged[key] = { panel, command, args };
  }
  return merged;
}
