import { ActiveTransportManager } from "../../helpers/transport";

// Fires a server-side Action, as a ClientMediator client instead of every call
// site hand-rolling ActiveTransportManager.Send({ command: "execute_action", ... }).
// Registered once by useGameInitialization so anything — keyboard shortcuts,
// addons, the Run dialog, another panel — can reach
// ClientMediator.sendCommand("Action", "Run", { name, args }).
//
// Permissions are enforced server-side inside the action pipeline itself
// (RequirePermissionStepDefinition etc.), the same way the un-gated Run dialog
// already works — this wrapper doesn't grant any capability beyond what's
// already reachable by sending "execute_action" directly.
export const ActionService = {
  panel: "Action",
  id: "ActionService",

  $meta: {
    Run: {
      description: 'Runs a server-side Action by name (e.g. "addonPrefix/actionName"), with optional args.',
      args: [
        { name: 'name', type: 'string', required: true },
        { name: 'args', type: 'object', required: false },
      ],
    },
  },

  Run: ({ name, args } = {}) =>
    ActiveTransportManager.Send({ command: "execute_action", data: { Action: name, Args: args } }),
};

export default ActionService;
