import ClientMediator from "../../../../ClientMediator";

// What a token's parts do when clicked or hovered.
/**
 * Maps tokenData.actions keys to Fabric.js per-object event names.
 *
 * IMPORTANT: `onClick` is intentionally absent here.
 * Fabric.js 5.x does not reliably fire `mouseup` on non-selectable objects.
 * `onClick` is handled at the canvas level via OnTokenUIActionClickBehavior
 * so it always fires regardless of selectability.
 *
 * Add entries here only for events that Fabric reliably fires per-object.
 */
const TOKEN_UI_EVENT_MAP = Object.freeze({
  onDblClick:   "mousedblclick",  // canvas fires this reliably per-object
  onHover:      "mouseover",
  onHoverEnd:   "mouseout",
  onRightClick: "mousedown",      // filtered to button === 2 at wire-up time
  onMouseDown:  "mousedown",
});

/** Action keys whose cursor should become a pointer on hover. */
const POINTER_CURSOR_ACTIONS = new Set(["onClick", "onDblClick", "onRightClick"]);

/**
 * ClientMediator panel.command pairs that token UI elements are allowed to call.
 *
 * Security note: token JSON is authored by developers/GM and runs in the trusted
 * client context, but this allowlist prevents a compromised or malicious token
 * template from calling destructive commands (DeleteGame, DeleteAllElements, etc.).
 *
 * Extend this list when new commands are needed by token UI.
 * Format: "Panel.Command": true
 */
const ALLOWED_TOKEN_UI_MEDIATOR_COMMANDS = Object.freeze({
  // ── Panels ─────────────────────────────────────────────────────────────
  "Game.CreateNewPanel":     true,   // open card panel, custom panels, etc.

  // ── Read-only game state ────────────────────────────────────────────────
  "Game.GetPlayers":         true,
  "Game.GetCurrentPlayer":   true,
  "Game.GetGameId":          true,
  "Game.GetIsGM":            true,
  "Game.GetCanEditGame":     true,

  // ── Map ─────────────────────────────────────────────────────────────────
  "BattleMap.GetSelectedMap": true,

  // ── Properties (status set/clear, etc.) ─────────────────────────────────
  "Properties.GetByNames":   true,
  "Properties.GetProperties": true,
  "Properties.Add":          true,
  "Properties.Update":       true,
  "Properties.Remove":       true,

  // ── Chat ─────────────────────────────────────────────────────────────────
  "Chat.SendMessage":        true,
});

export const tokenUiActions = {
  meta: {
  },

  methods: {
    // ── Token UI actions ──────────────────────────────────────────────────────

    /**
     * Wires Fabric.js event listeners onto a token UI element for every action
     * declared in `element.tokenData.actions`.
     *
     * Token JSON example:
     *   "actions": {
     *     "onClick":    { "Action": "openCard" },
     *     "onDblClick": { "Action": "openCard" },
     *     "onHover":    { "Action": "highlight" },
     *     "onHoverEnd": { "Action": "clearHighlight" },
     *     "onRightClick": { "Action": "contextMenu" }
     *   }
     *
     * Supported keys are listed in TOKEN_UI_EVENT_MAP at the top of this file.
     */
    _wireTokenUIActions(element, parentToken) {
      const actions = element.tokenData?.actions;
      if (!actions) return;

      let needsPointerCursor = false;

      for (const [eventKey, action] of Object.entries(actions)) {
        const fabricEvent = TOKEN_UI_EVENT_MAP[eventKey];
        if (!fabricEvent) {
          console.warn(
            `TokenManager: unknown action event key "${eventKey}" on element "${element.name}". ` +
            `Supported keys: ${Object.keys(TOKEN_UI_EVENT_MAP).join(", ")}`
          );
          continue;
        }

        if (POINTER_CURSOR_ACTIONS.has(eventKey)) needsPointerCursor = true;

        if (eventKey === "onRightClick") {
          element.on(fabricEvent, (opt) => {
            if (opt.e?.button !== 2) return;
            this._dispatchTokenUIAction(parentToken, element, action);
          });
        } else {
          element.on(fabricEvent, () => {
            this._dispatchTokenUIAction(parentToken, element, action);
          });
        }
      }

      if (needsPointerCursor) element.hoverCursor = "pointer";
    },

    /**
     * Dispatches a single token UI action.
     *
     * Two action types are supported, selected by which key is present:
     *
     * ── Server-side  (key: "Action") ─────────────────────────────────────────
     *   Runs it via ClientMediator.sendCommand("Action", "Run", ...) (ActionService,
     *   wraps `execute_action`).  `cardId` and `tokenId` are always appended to
     *   `args` so the server handler can scope the request.
     *
     *   Example:
     *     { "Action": "set_status_poisoned", "Args": { "value": "true" } }
     *
     * ── Client-side  (key: "ClientMediatorAction") ────────────────────────────
     *   Calls ClientMediator.sendCommand with the given panel/command/data.
     *   Only commands listed in ALLOWED_TOKEN_UI_MEDIATOR_COMMANDS are permitted.
     *   Template variables `{{cardId}}` and `{{tokenId}}` inside string values of
     *   `data` are substituted with the real IDs at dispatch time.
     *
     *   Example:
     *     { "ClientMediatorAction": {
     *         "panel":   "Game",
     *         "command": "CreateNewPanel",
     *         "data":    { "type": "CardPanel", "props": { "id": "{{cardId}}" } }
     *     }}
     *
     * @param {FabricObject}          parentToken  The main token canvas object.
     * @param {FabricObject}          element      The UI element that fired the action.
     * @param {object}                action       The action descriptor from tokenData.
     */
    _dispatchTokenUIAction(parentToken, element, action) {
      // ── Server-side action ──────────────────────────────────────────────────
      if (action.Action) {
        ClientMediator.sendCommand("Action", "Run", {
          name: action.Action,
          args: {
            ...(action.Args ?? {}),
            cardId:  parentToken?.tokenData?.cardId,
            tokenId: parentToken?.id,
          },
        });
        return;
      }

      // ── Client-side ClientMediator action ───────────────────────────────────
      if (action.ClientMediatorAction) {
        const { panel, command, data } = action.ClientMediatorAction;

        if (!panel || !command) {
          console.warn(
            `TokenManager: ClientMediatorAction on "${element?.name}" is missing "panel" or "command"`,
            action
          );
          return;
        }

        const key = `${panel}.${command}`;
        if (!ALLOWED_TOKEN_UI_MEDIATOR_COMMANDS[key]) {
          console.warn(
            `TokenManager: blocked ClientMediatorAction "${key}" on "${element?.name}" — not in allowlist. ` +
            `Allowed: ${Object.keys(ALLOWED_TOKEN_UI_MEDIATOR_COMMANDS).join(", ")}`
          );
          return;
        }

        const context = {
          cardId:  parentToken?.tokenData?.cardId ?? "",
          tokenId: parentToken?.id ?? "",
        };
        ClientMediator.sendCommand(panel, command, this._resolveTemplates(data ?? {}, context));
        return;
      }

      console.warn(
        `TokenManager: action on "${element?.name}" has neither "Action" nor "ClientMediatorAction" key`,
        action
      );
    },

    /**
     * Recursively substitutes `{{key}}` placeholders inside string values of
     * a plain object/array/string tree.  Non-string leaves are returned as-is.
     */
    _resolveTemplates(obj, context) {
      if (typeof obj === "string") {
        return obj.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] ?? "");
      }
      if (Array.isArray(obj)) {
        return obj.map((v) => this._resolveTemplates(v, context));
      }
      if (obj && typeof obj === "object") {
        return Object.fromEntries(
          Object.entries(obj).map(([k, v]) => [k, this._resolveTemplates(v, context)])
        );
      }
      return obj;
    },

    /**
     * Public entry point for canvas-level behaviors (e.g. OnTokenUIActionClickBehavior)
     * to dispatch a token UI action without duplicating the allowlist logic.
     *
     * Called via ClientMediator with contextId so it routes to the correct
     * TokenManager instance when multiple battlemaps are open.
     */
    DispatchTokenUIAction({ parentToken, element, action }) {
      this._dispatchTokenUIAction(parentToken, element, action);
    },
  },
};
