import ClientMediator from "../../../../ClientMediator";

/**
 * Canvas-level `mouse:up` handler for token UI element actions.
 *
 * Fabric.js 5.x does not reliably fire `mouseup` on non-selectable objects,
 * so `onClick` actions are dispatched here rather than via per-object listeners.
 * The canvas-level target is well-defined: it is the topmost visible, evented
 * object under the cursor at mouse-up time.
 *
 * Other action events (onHover, onDblClick, etc.) continue to use per-object
 * listeners wired in TokenManager._wireTokenUIActions, since Fabric fires those
 * events reliably regardless of selectability.
 */
export class OnTokenUIActionClickClientBehavior {
  Handle(event, canvas, map, battleMapId) {
    const target = event.target;

    // Only act on token UI elements that declare an onClick action
    if (!target?.isTokenUI) return;
    const action = target.tokenData?.actions?.onClick;
    if (!action) return;

    // Find the token that owns this UI element
    const parentToken = canvas
      .getObjects()
      .find((o) => o.additionalObjects?.includes(target));

    if (!parentToken) return;

    // Delegate to the TokenManager instance for this battlemap so the allowlist
    // and dispatch logic remain in one place.
    ClientMediator.sendCommand("battlemap_token", "DispatchTokenUIAction", {
      contextId: battleMapId,
      parentToken,
      element: target,
      action,
    });
  }
}
